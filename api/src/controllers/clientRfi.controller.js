// 13 Nov 2026: client / external RFIs.
//   Client raises the RFI by email
//   → SPOC registers it in DT-MIS and assigns the concerned team lead
//   → the team lead reviews (with engineers / QA-QC) and submits the response
//   → the response is emailed automatically to the raiser, SPOC and the
//     relevant stakeholders in CC
//   → PTL and above see the full RFI log (records, status, assignment, history).
import { z } from 'zod';
import { Rfi } from '../models/Rfi.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { canReadProject } from '../utils/projectScope.js';
import { expandServices } from '../config/services.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { sendMail, mailLogLine } from '../services/mailer.js';
import { isSuperRole } from '../config/roles.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const email = z.string().trim().toLowerCase().email();
const RESPONDER_ROLES = ['team_lead', 'assoc_technical_director', 'technical_director', 'associate_director'];
const POP = [
  { path: 'project', select: 'name code jobNumber branch' },
  { path: 'assignedLead', select: 'firstName lastName empId designation email department' },
  { path: 'raisedBy', select: 'name email role' },
  { path: 'spoc', select: 'name email' },
  { path: 'leadResponse.by', select: 'name email' },
  { path: 'history.by', select: 'name' },
];

const registerSchema = z.object({
  project: objectId,
  type: z.string().trim().min(1).max(120).default('Client RFI'),
  subject: z.string().trim().max(300).optional(),
  description: z.string().trim().min(1).max(5000),
  service: z.string().trim().max(60).optional(),
  raiserName: z.string().trim().max(200).optional(),
  raiserOrg: z.string().trim().max(200).optional(),
  raiserEmail: email,
  ccEmails: z.array(email).max(20).optional(),
  receivedOn: z.coerce.date().optional(),
  due: z.coerce.date().optional(),
  assignedLead: objectId,
}).strict();

const respondSchema = z.object({ response: z.string().trim().min(1).max(5000) }).strict();
const statusSchema = z.object({ status: z.enum(['Open', 'In Progress', 'Closed']), note: z.string().trim().max(2000).optional() }).strict();

const empName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.empId || '';

async function nextRfiNo() {
  const { Counter } = await import('../models/Counter.js');
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate({ name: `rfi-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return `RFI-${year}-${String(counter.seq).padStart(3, '0')}`;
}

// Team leads of the project's teams (the SPOC assigns the RFI to one of them).
export async function rfiLeadOptions(req, res, next) {
  try {
    const project = String(req.query.project ?? '');
    if (!/^[0-9a-fA-F]{24}$/.test(project)) return res.status(400).json({ message: 'Select a valid project.' });
    if (!await canReadProject(req.user, project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    const teams = await Team.find({ projects: project, active: { $ne: false }, lead: { $ne: null } })
      .select('name service lead').populate('lead', 'firstName lastName empId designation department status').lean();
    const byLead = new Map();
    for (const t of teams) {
      if (!t.lead || t.lead.status === 'Exited') continue;
      const key = String(t.lead._id);
      const row = byLead.get(key) ?? { employee: t.lead, services: [] };
      for (const s of expandServices([t.service])) if (!row.services.includes(s)) row.services.push(s);
      byLead.set(key, row);
    }
    return res.json({ items: [...byLead.values()] });
  } catch (err) { return next(err); }
}

export async function registerClientRfi(req, res, next) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ? `Invalid RFI: ${parsed.error.issues[0].path.join('.')} ${parsed.error.issues[0].message}` : 'Invalid RFI.' });
  try {
    const data = parsed.data;
    if (!await canReadProject(req.user, data.project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    const onProject = await Team.exists({ projects: data.project, lead: data.assignedLead, active: { $ne: false } });
    if (!onProject) return res.status(400).json({ message: 'Assign the RFI to a team lead of this project.' });
    const lead = await Employee.findById(data.assignedLead).select('firstName lastName empId email').lean();
    const doc = await Rfi.create({
      ...data,
      kind: 'client',
      rfiNo: await nextRfiNo(),
      team: data.service,
      assignedTo: empName(lead),
      raisedBy: req.user.id,
      spoc: req.user.id,
      status: 'Open',
      history: [{ action: 'Registered and assigned', note: `Assigned to ${empName(lead)}`, by: req.user.id, at: new Date() }],
    });
    try {
      const users = await userIdsForEmployees([data.assignedLead]);
      await notify({
        users,
        project: data.project,
        link: { view: 'my-team' },
        title: `Client RFI ${doc.rfiNo} assigned to you`,
        detail: (data.subject || data.description).slice(0, 120),
        type: 'rfi',
      });
    } catch { /* bell is best-effort */ }
    const item = await Rfi.findById(doc._id).populate(POP).lean();
    return res.status(201).json({ item });
  } catch (err) { return next(err); }
}

async function canRespond(user, rfi) {
  if (isSuperRole(user.role)) return true;
  if (!RESPONDER_ROLES.includes(user.role)) return false;
  const me = await User.findById(user.id).select('employee').lean();
  if (me?.employee && String(me.employee) === String(rfi.assignedLead?._id ?? rfi.assignedLead)) return true;
  // Directors above the lead on that project may answer on the lead's behalf.
  return user.role !== 'team_lead' && await canReadProject(user, rfi.project?._id ?? rfi.project);
}

export async function respondClientRfi(req, res, next) {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A response is required.' });
  try {
    const rfi = await Rfi.findById(req.params.id);
    if (!rfi || rfi.kind !== 'client') return res.status(404).json({ message: 'RFI not found.' });
    if (!await canRespond(req.user, rfi)) return res.status(403).json({ message: 'Only the team lead this RFI is assigned to can respond.' });
    if (rfi.status === 'Closed') return res.status(409).json({ message: 'This RFI is already closed.' });
    const now = new Date();
    const [project, spocUser, lead, me] = await Promise.all([
      Project.findById(rfi.project).select('name code jobNumber').lean(),
      User.findById(rfi.spoc ?? rfi.raisedBy).select('name email employee').lean(),
      Employee.findById(rfi.assignedLead).select('firstName lastName email').lean(),
      User.findById(req.user.id).select('name email').lean(),
    ]);
    const spocEmp = spocUser?.employee ? await Employee.findById(spocUser.employee).select('email').lean() : null;
    const projText = [project?.jobNumber || project?.code, project?.name].filter(Boolean).join(' · ');
    const subject = `Response to ${rfi.rfiNo}${rfi.subject ? ` — ${rfi.subject}` : ''}${projText ? ` (${projText})` : ''}`;
    const text = [
      `Dear ${rfi.raiserName || 'Sir / Madam'},`,
      '',
      `Please find below our response to your RFI ${rfi.rfiNo}${projText ? ` for ${projText}` : ''}.`,
      '',
      `Your query: ${rfi.description}`,
      '',
      `Response: ${parsed.data.response}`,
      '',
      `Responded by: ${me?.name ?? empName(lead) ?? 'Team Lead'}`,
      `Design Tree Service Consultants`,
    ].join('\n');
    const cc = [spocUser?.email, spocEmp?.email, lead?.email, ...(rfi.ccEmails ?? [])];
    const result = await sendMail({ to: [rfi.raiserEmail], cc, subject, text });
    rfi.leadResponse = { text: parsed.data.response, by: req.user.id, at: now };
    rfi.clientResponse = { text: parsed.data.response, by: req.user.id, at: now };
    rfi.status = 'Responded';
    rfi.emailLog = [...(rfi.emailLog ?? []), mailLogLine(result, `${rfi.rfiNo} response`)];
    rfi.history = [...(rfi.history ?? []), { action: 'Responded', note: result.sent ? 'Response emailed to the raiser' : `Response saved; email ${result.error}`, by: req.user.id, at: now }];
    await rfi.save();
    try {
      if (rfi.spoc) await notify({ users: [String(rfi.spoc)], project: rfi.project, link: { view: 'project-detail', id: String(rfi.project) }, title: `${rfi.rfiNo} responded`, detail: parsed.data.response.slice(0, 120), type: 'rfi' });
    } catch { /* best-effort */ }
    const item = await Rfi.findById(rfi._id).populate(POP).lean();
    return res.json({ item, email: result });
  } catch (err) { return next(err); }
}

// SPOC moves the RFI on (In Progress / Closed); any reader may not.
export async function setClientRfiStatus(req, res, next) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid status.' });
  try {
    const rfi = await Rfi.findById(req.params.id);
    if (!rfi || rfi.kind !== 'client') return res.status(404).json({ message: 'RFI not found.' });
    if (!await canReadProject(req.user, rfi.project)) return res.status(404).json({ message: 'RFI not found.' });
    const isSpoc = req.user.role === 'coordinator';
    if (!isSpoc && !(await canRespond(req.user, rfi))) return res.status(403).json({ message: 'Not allowed.' });
    rfi.status = parsed.data.status;
    rfi.history = [...(rfi.history ?? []), { action: parsed.data.status, note: parsed.data.note, by: req.user.id, at: new Date() }];
    await rfi.save();
    const item = await Rfi.findById(rfi._id).populate(POP).lean();
    return res.json({ item });
  } catch (err) { return next(err); }
}

// Client RFIs in the caller's scope. ?mine=true → assigned to me (team lead).
export async function listClientRfis(req, res, next) {
  try {
    const { projectScopeIds } = await import('../utils/projectScope.js');
    const filter = { kind: 'client' };
    const ids = await projectScopeIds(req.user);
    if (ids !== null) filter.project = { $in: ids };
    if (req.query.project) {
      if (ids !== null && !ids.includes(String(req.query.project))) return res.json({ items: [], total: 0 });
      filter.project = req.query.project;
    }
    if (req.query.mine === 'true') {
      const me = await User.findById(req.user.id).select('employee').lean();
      filter.assignedLead = me?.employee ?? null;
      delete filter.project;
    }
    if (req.query.status) filter.status = req.query.status;
    const items = await Rfi.find(filter).sort({ createdAt: -1 }).limit(500).populate(POP).lean();
    return res.json({ items, total: items.length });
  } catch (err) { return next(err); }
}
