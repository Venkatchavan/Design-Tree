import { z } from 'zod';
import { ServiceHandover } from '../models/ServiceHandover.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { expandServices } from '../config/services.js';
import { canReadProject, projectScopeIds } from '../utils/projectScope.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const handoverSchema = z.object({
  project: objectId,
  fromService: z.string().trim().min(1),
  toServices: z.array(z.string().trim().min(1)).min(1),
  stage: z.string().trim().max(100).optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();
const id = (value) => String(value?._id ?? value ?? '');
const overlaps = (a, b) => expandServices([a]).some((s) => expandServices(b).includes(s));
const label = (services) => expandServices(services).join(', ') || services.join(', ');

// Team of the next service(s) on the project: the saved service teams (lead and
// members) and the approved project leads of those services.
async function teamOf(project, services) {
  const teams = await Team.find({ projects: project._id, active: { $ne: false } }).select('service lead members.employee').lean();
  const ids = [
    ...teams.filter((t) => overlaps(t.service, services)).flatMap((t) => [t.lead, ...(t.members ?? []).map((m) => m.employee)]),
    ...(project.principalTeamLeads ?? []).filter((r) => r.employee && r.approvalStatus !== 'Proposed' && overlaps(r.service, services)).map((r) => r.employee),
  ].filter(Boolean).map(id);
  return [...new Set(ids)];
}

const POPULATE = [
  { path: 'project', select: 'name code jobNumber' },
  { path: 'recipients', select: 'firstName lastName empId' },
  { path: 'notifiedBy', select: 'name' },
  { path: 'acknowledgedBy', select: 'name' },
];

// GET /api/service-handovers?project=&mine=1
// mine=1 lists the handovers sent to the signed-in person's team.
export async function listHandovers(req, res, next) {
  try {
    const filter = {};
    const { project, mine } = req.query;
    if (typeof project === 'string' && project) {
      if (!objectId.safeParse(project).success) return res.status(400).json({ message: 'Choose a valid project.' });
      if (!await canReadProject(req.user, project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
      filter.project = project;
    }
    if (mine === '1') {
      const me = await User.findById(req.user.id).select('employee').lean();
      if (!me?.employee) return res.json({ items: [] });
      filter.recipients = me.employee;
    } else if (!filter.project) {
      const ids = await projectScopeIds(req.user);
      if (ids) filter.project = { $in: ids };
    }
    const items = await ServiceHandover.find(filter).sort({ createdAt: -1 }).limit(500).populate(POPULATE).lean();
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
}

// POST /api/service-handovers — the SPOC intimates the next service.
export async function createHandover(req, res, next) {
  try {
    const parsed = handoverSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Choose the completed service and the next service.' });
    const b = parsed.data;
    if (!await canReadProject(req.user, b.project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    const project = await Project.findById(b.project).select('name code jobNumber principalTeamLeads').lean();
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const toServices = [...new Set(b.toServices)].filter((s) => !overlaps(s, [b.fromService]));
    if (!toServices.length) return res.status(400).json({ message: 'The next service must differ from the completed service.' });
    const recipients = await teamOf(project, toServices);
    if (!recipients.length) return res.status(400).json({ message: `No team is allocated for ${label(toServices)} on this project yet.` });
    const doc = await ServiceHandover.create({ ...b, toServices, recipients, notifiedBy: req.user.id });
    try {
      await notify({
        users: await userIdsForEmployees(recipients),
        project: project._id,
        link: { view: 'my-team', id: id(project) },
        title: `Drawings ready: ${project.name} (${project.code || project.jobNumber || ''})`,
        detail: `${label([b.fromService])} drawings${b.stage ? ` (${b.stage})` : ''} are complete and ready for ${label(toServices)}.${b.note ? ` ${b.note}` : ''}`,
        type: 'service-handover',
      });
    } catch {
      /* best-effort */
    }
    return res.status(201).json({ item: await ServiceHandover.findById(doc._id).populate(POPULATE).lean() });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/service-handovers/:id/acknowledge — the next service's team takes it up.
export async function acknowledgeHandover(req, res, next) {
  try {
    if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ message: 'Handover not found.' });
    const me = await User.findById(req.user.id).select('employee').lean();
    const doc = await ServiceHandover.findById(req.params.id);
    if (!doc || !me?.employee || !doc.recipients.some((r) => id(r) === id(me.employee))) {
      return res.status(404).json({ message: 'Handover not found.' });
    }
    if (doc.status === 'Acknowledged') return res.status(409).json({ message: 'This handover is already acknowledged.' });
    doc.status = 'Acknowledged';
    doc.acknowledgedBy = req.user.id;
    doc.acknowledgedAt = new Date();
    await doc.save();
    try {
      const project = await Project.findById(doc.project).select('name code jobNumber').lean();
      await notify({
        users: [doc.notifiedBy].filter(Boolean),
        project: doc.project,
        link: { view: 'my-coordination' },
        title: `Handover acknowledged: ${project?.name ?? 'Project'}`,
        detail: `${label(doc.toServices)} acknowledged the ${label([doc.fromService])} handover.`,
        type: 'service-handover',
      });
    } catch {
      /* best-effort */
    }
    return res.json({ item: await ServiceHandover.findById(doc._id).populate(POPULATE).lean() });
  } catch (err) {
    return next(err);
  }
}
