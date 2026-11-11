import { isTeamDirector } from '../utils/directorTeams.js';
import { taskRoster } from '../utils/taskRoster.js';
import { canReadProject } from '../utils/projectScope.js';
import { isSuperRole } from '../config/roles.js';
import { narrowByProject, projectScopeIds } from '../utils/projectScope.js';
import { z } from 'zod';
import { Deliverable, DeliverableLog } from '../models/Deliverable.js';
import { Employee } from '../models/Employee.js';
import { TASK_STATUSES } from '../models/Task.js';

const zTaskStatus = z
  .object({ status: z.enum(TASK_STATUSES) })
  .strict();
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { Drawing } from '../models/Drawing.js';
import { Recruitment } from '../models/Recruitment.js';
import { Revision } from '../models/Revision.js';
import { Task } from '../models/Task.js';
import { makeCrud } from '../utils/crud.js';
import {
  deliverableSchema,
  deliverableUpdateSchema,
  drawingSchema,
  drawingUpdateSchema,
  recruitmentSchema,
  recruitmentStatusSchema,
  recruitmentUpdateSchema,
  revisionSchema,
  revisionStatusSchema,
  revisionUpdateSchema,
  taskSchema,
  taskUpdateSchema,
} from '../validation/phase2.schema.js';

const POP_EMP = 'firstName lastName empId designation';
const POP_PROJ = 'name code branch';

export async function taskAssignees(req, res, next) {
  try {
    const project = req.query.project;
    if (typeof project !== 'string' || !/^[0-9a-fA-F]{24}$/.test(project)) return res.status(400).json({ message: 'Select a valid project.' });
    if (!await canReadProject(req.user, project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    return res.json(await taskRoster(req.user, project));
  } catch (error) { return next(error); }
}

export async function taskMemberAccess(req,res,next) {
  try {
    const existing = req.params.id ? await Task.findById(req.params.id) : null;
    if (existing && isTeamDirector(req.user) && String(existing.createdBy)!==String(req.user.id)) return res.status(404).json({message:'Task not found.'});
    const project = req.body.project || existing?.project;
    if (!project || !await canReadProject(req.user,project)) return res.status(403).json({message:'Project is not assigned to you.'});
    const roster = await taskRoster(req.user, project);
    const allowed = new Set(roster.items.map(m => String(m.employee._id)));
    const members = req.body.members ?? existing?.members ?? [];
    if(!allowed.size && isTeamDirector(req.user)) return res.status(403).json({message:'No team is assigned to you for this project.'});
    if(Array.isArray(members) && members.some(id=>!allowed.has(String(id))))return res.status(400).json({message:'Assign work to members of your authorized project team only.'});
    return next();
  }catch(err){return next(err);}
}

const taskCrud = makeCrud(Task, {
  scopedByProject: true,
  create: taskSchema,
  update: taskUpdateSchema,
  decorate:(body,req)=>({...body,...(req.method==='POST'?{createdBy:req.user.id}:{})}),
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    if (req.query.member) f.members = req.query.member;
    if (isTeamDirector(req.user)) f.createdBy=req.user.id;
    return f;
  },
  populate: [
    { path: 'members', select: POP_EMP },
    { path: 'project', select: POP_PROJ },
  ],
});

// Bell notice for newly assigned members (all members on create; only added
// members on update). Best effort: never fails the save.
async function notifyAssigned(task, previous = []) {
  const before = new Set(previous.map(String));
  const added = (task.members ?? []).filter((m) => !before.has(String(m?._id ?? m)));
  const users = await userIdsForEmployees(added);
  if (!users.length) return;
  const what = [task.stage, task.deliverable].filter(Boolean).join(' · ') || 'New task';
  await notify({
    users,
    project: task.project,
    link: { view: 'my-work' },
    type: 'task-assigned',
    title: `Work assigned: ${what}`,
    detail: task.dueDate ? `Due ${new Date(task.dueDate).toISOString().slice(0, 10)}` : 'No due date set',
  });
}

function withAssignNotice(handler, { update = false } = {}) {
  return async (req, res, next) => {
    let previous = [];
    try {
      if (update) previous = (await Task.findById(req.params.id).select('members').lean())?.members ?? [];
    } catch { /* handler reports the real error */ }
    const json = res.json.bind(res);
    res.json = (body) => {
      const out = json(body);
      if (body?.item && res.statusCode < 300) notifyAssigned(body.item, previous).catch(() => {});
      return out;
    };
    return handler(req, res, next);
  };
}

export const tasks = {...taskCrud, create: withAssignNotice(taskCrud.create), update: withAssignNotice(taskCrud.update, { update: true }), async get(req,res,next) {
  try {
    if(isTeamDirector(req.user) && !await Task.exists({_id:req.params.id,createdBy:req.user.id})) return res.status(404).json({message:'Task not found.'});
    return taskCrud.get(req,res,next);
  }catch(err){return next(err);}
}};

export async function myTasks(req, res, next) {
  try {
    const { User } = await import('../models/User.js');
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await Task.find({ members: me.employee })
      .populate('project', POP_PROJ)
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

async function logDeliverable(project, action, payload, by) {
  await DeliverableLog.create({
    project,
    action,
    stage: payload.stage,
    deliverable: payload.deliverable ?? payload.specify,
    details: payload.details,
    plannedDate: payload.plannedDate,
    dueDate: payload.dueDate,
    revisedDate: payload.revisedDate,
    reason: payload.reason,
    by,
  });
}

const deliverableCrud = makeCrud(Deliverable, {
  scopedByProject: true,
  create: deliverableSchema,
  update: deliverableUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [
    { path: 'project', select: POP_PROJ },
    { path: 'assignedTo', select: POP_EMP },
    { path: 'createdBy', select: 'name email' },
  ],
});

const DELIVERABLE_TRACKED = ['deliverable', 'stage', 'assignedTo', 'plannedDate', 'dueDate', 'revisedDate', 'revisedReason', 'status'];
const TRACKED_LABEL = { assignedTo: 'assignee', revisedDate: 'revised date', revisedReason: 'reason' };
const dayOf = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const trackedValue = (doc, key) => {
  const v = doc?.[key];
  if (key === 'plannedDate' || key === 'dueDate' || key === 'revisedDate') return dayOf(v);
  return v == null ? '' : String(v);
};

// Every change to the list is written to the deliverables log, which the whole
// project team can read.
export const deliverables = {
  ...deliverableCrud,
  async update(req, res, next) {
    try {
      const before = await Deliverable.findById(req.params.id).lean();
      if (!before || !await canReadProject(req.user, before.project)) {
        return res.status(404).json({ message: 'Not found.' });
      }
      if (req.body?.project && String(req.body.project) !== String(before.project)) {
        return res.status(400).json({ message: 'A record cannot be moved to another project.' });
      }
      const parsed = deliverableUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid data.' });
      // A revised date is only accepted with the reason for it.
      const dateRevised = parsed.data.revisedDate && dayOf(parsed.data.revisedDate) !== dayOf(before.revisedDate);
      if (dateRevised && !parsed.data.revisedReason?.trim()) {
        return res.status(400).json({ message: 'Give a reason for the revised date.' });
      }
      const doc = await Deliverable.findByIdAndUpdate(req.params.id, parsed.data, {
        new: true,
        returnDocument: 'after',
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: 'Not found.' });
      const changedKeys = DELIVERABLE_TRACKED
        .filter((k) => k in parsed.data && trackedValue(before, k) !== trackedValue(doc, k));
      const names = new Map();
      if (changedKeys.includes('assignedTo')) {
        const emps = await Employee.find({ _id: { $in: [before.assignedTo, doc.assignedTo].filter(Boolean) } })
          .select('firstName lastName').lean();
        for (const e of emps) names.set(String(e._id), [e.firstName, e.lastName].filter(Boolean).join(' '));
      }
      const show = (d, k) => (k === 'assignedTo' ? names.get(trackedValue(d, k)) : trackedValue(d, k)) || '—';
      const changes = changedKeys
        .map((k) => `${TRACKED_LABEL[k] ?? k}: ${show(before, k)} → ${show(doc, k)}`);
      if (changes.length > 0) {
        await logDeliverable(
          doc.project,
          dateRevised ? 'Revised' : 'Changed',
          {
            stage: doc.stage,
            deliverable: doc.deliverable,
            details: changes.join('; '),
            plannedDate: doc.plannedDate,
            dueDate: doc.dueDate,
            revisedDate: doc.revisedDate,
            reason: dateRevised ? doc.revisedReason : undefined,
          },
          req.user.id,
        );
      }
      return res.status(200).json({ item: doc });
    } catch (err) {
      return next(err);
    }
  },
};

export async function createDeliverable(req, res, next) {
  const parsed = deliverableSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  if (parsed.data.revisedDate && !parsed.data.revisedReason?.trim()) {
    return res.status(400).json({ message: 'Give a reason for the revised date.' });
  }
  try {
    const doc = await Deliverable.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    await logDeliverable(
      doc.project,
      'Created',
      { ...parsed.data, reason: parsed.data.revisedDate ? parsed.data.revisedReason : undefined, details: `Due ${parsed.data.dueDate ?? '—'}` },
      req.user.id,
    );
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function listDeliverableLog(req, res, next) {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    narrowByProject(filter, 'project', await projectScopeIds(req.user));
    const rows = await DeliverableLog.find(filter)
      .populate('project', POP_PROJ)
      .populate('by', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    // Entries written before dates were stored take them from the deliverable's current row.
    const missing = rows.filter((r) => !r.dueDate && !r.plannedDate);
    let items = rows;
    if (missing.length > 0) {
      const live = await Deliverable.find({ project: { $in: [...new Set(missing.map((r) => String(r.project?._id ?? r.project)))] } })
        .select('project stage deliverable plannedDate dueDate revisedDate').lean();
      const key = (p, s, d) => `${String(p?._id ?? p)}|${s ?? ''}|${d ?? ''}`;
      const byKey = new Map(live.map((d) => [key(d.project, d.stage, d.deliverable), d]));
      items = rows.map((r) => {
        if (r.dueDate || r.plannedDate) return r;
        const d = byKey.get(key(r.project, r.stage, r.deliverable));
        return d ? { ...r, plannedDate: d.plannedDate, dueDate: d.dueDate, revisedDate: r.revisedDate ?? d.revisedDate } : r;
      });
    }
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export const revisions = makeCrud(Revision, {
  scopedByProject: true,
  create: revisionSchema,
  update: revisionUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [
    { path: 'project', select: POP_PROJ },
    { path: 'assignedTo', select: POP_EMP },
  ],
});

export async function deleteDeliverable(req, res, next) {
  try {
    const { Deliverable } = await import('../models/Deliverable.js');
    const old = await Deliverable.findById(req.params.id);
    if (!old || !await canReadProject(req.user, old.project)) return res.status(404).json({ message: 'Not found.' });
    const doc = await Deliverable.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    await logDeliverable(
      doc.project,
      'Removed',
      { stage: doc.stage, deliverable: doc.deliverable, details: 'Removed from the list', plannedDate: doc.plannedDate, dueDate: doc.dueDate, revisedDate: doc.revisedDate },
      req.user.id,
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function createRevision(req, res, next) {
  const parsed = revisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    // Recipients: assigned designer, project SPOC, the logging TL (copy) and
    // any directors / ATD / DMH ticked on the form. Mail is logged only (queued).
    const { Employee } = await import('../models/Employee.js');
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const { User } = await import('../models/User.js');
    const alloc = await SpocAllocation.findOne({ project: parsed.data.project, status: 'Approved' })
      .select('coordinator')
      .lean();
    const me = await User.findById(req.user.id).select('employee').lean();
    const employeeIds = [
      ...new Set(
        [parsed.data.assignedTo, alloc?.coordinator, me?.employee, ...(parsed.data.notifyEmployees ?? [])]
          .filter(Boolean)
          .map(String),
      ),
    ];
    const people = await Employee.find({ _id: { $in: employeeIds } }).select('firstName lastName email').lean();
    const emailLog = people.map(
      (p) => `Notified ${p.firstName ?? ''} ${p.lastName ?? ''} <${p.email ?? 'no email on file'}> — revision logged (queued, not sent)`.replace(/\s+/g, ' '),
    );
    const doc = await Revision.create({
      ...parsed.data,
      notifyEmployees: parsed.data.notifyEmployees ?? [],
      emailLog,
      createdBy: req.user.id,
    });
    try {
      const assignees = await userIdsForEmployees(employeeIds);
      const recipients = [...new Set(assignees)].filter((u) => u !== String(req.user.id));
      await notify({
        roles: ['team_lead'],
        users: recipients,
        project: parsed.data.project,
        link: { view: 'revision', id: String(doc._id) },
        title: `Revision logged: ${doc.drawing ?? doc.refNo ?? ''}`.trim(),
        detail: `${parsed.data.details ?? ''}`.slice(0, 120),
        type: 'revision',
      });
    } catch {
      /* bell/push best-effort only */
    }
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

const REVISION_CLEAR_ROLES = ['team_lead', 'assoc_technical_director', 'technical_director'];

// Revision workflow:
//   lead logs it and allots it to a team member            -> Open
//   the team member addresses it and resubmits             -> Resubmitted (lead is notified)
//   the lead acts: Approve (Cleared) or Revise + what to do -> Revise goes back to the member
export async function setRevisionStatus(req, res, next) {
  const parsed = revisionStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const { status } = parsed.data;
    const note = parsed.data.note?.trim() ?? '';
    const old = await Revision.findById(req.params.id);
    if (!old) return res.status(404).json({ message: 'Not found.' });
    const patch = { status };
    const entry = { action: status === 'Cleared' ? 'Approved' : status, note: note || undefined, by: req.user.id, at: new Date() };
    if (status === 'Resubmitted') {
      // A resubmission is the team member's own act: only the employee the
      // revision is assigned to can mark it resubmitted, not the lead who
      // logged it.
      const { User } = await import('../models/User.js');
      const me = await User.findById(req.user.id).select('employee').lean();
      if (!old.assignedTo || !me?.employee || String(me.employee) !== String(old.assignedTo)) {
        return res.status(403).json({ message: 'Only the team member this revision is assigned to can resubmit it.' });
      }
      if (!['Open', 'Revise'].includes(old.status)) {
        return res.status(409).json({ message: `This revision is already ${old.status.toLowerCase()}.` });
      }
      patch.resubmittedAt = new Date();
    } else if (status === 'Revise' || status === 'Cleared') {
      // Approve / revise is the lead's decision, taken once the member has resubmitted.
      if (!REVISION_CLEAR_ROLES.includes(req.user.role) && !isSuperRole(req.user.role)) {
        return res.status(403).json({ message: 'Only the team lead or a director can approve or send back a revision.' });
      }
      if (!await canReadProject(req.user, old.project)) return res.status(404).json({ message: 'Not found.' });
      if (old.status === 'Cleared') return res.status(409).json({ message: 'This revision is already approved.' });
      // A revision nobody is allotted to has no member to wait for.
      if (old.assignedTo && old.status !== 'Resubmitted') {
        return res.status(409).json({ message: 'Waiting for the team member to resubmit this revision.' });
      }
      if (status === 'Revise') {
        if (!note) return res.status(400).json({ message: 'Say what needs to be revised.' });
        patch.leadNote = note;
      } else {
        patch.clearedAt = new Date();
      }
    } else {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    const doc = await Revision.findByIdAndUpdate(
      req.params.id,
      { ...patch, $push: { reviewLog: entry } },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    try {
      const assignees = doc.assignedTo ? await userIdsForEmployees([doc.assignedTo]).catch(() => []) : [];
      const creator = doc.createdBy ? String(doc.createdBy?._id ?? doc.createdBy) : null;
      // Resubmitted goes to the lead who logged it; Revise / Approved go to the member.
      const targets = status === 'Resubmitted' ? (creator ? [creator] : []) : assignees;
      const recipients = [...new Set(targets)].filter(
        (u) => /^[0-9a-fA-F]{24}$/.test(u) && u !== String(req.user.id),
      );
      if (recipients.length > 0) {
        const what = { Resubmitted: 'resubmitted', Revise: 'needs revision', Cleared: 'approved' }[status];
        await notify({
          users: recipients,
          project: doc.project,
          link: { view: 'revision', id: String(doc._id) },
          title: `Revision ${what}: ${doc.drawing ?? doc.refNo ?? doc.details ?? ''}`.trim().slice(0, 140),
          detail: status === 'Revise' ? note.slice(0, 120) : '',
          type: 'revision',
        });
      }
    } catch {
      /* bell/push best-effort only */
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

const drawingCrud = makeCrud(Drawing, {
  scopedByProject: true,
  create: drawingSchema,
  update: drawingUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.stage) f.stage = req.query.stage;
    if (req.query.mine === 'true') f.sharedBy = req.user.id;
    return f;
  },
  decorate: (data, req) => req.method === 'POST'
    ? { ...data, sharedBy: req.user.id }
    : data,
  populate: [{ path: 'project', select: POP_PROJ }],
});

// Revise / Resubmit / Approved on a drawing is set by the team lead only.
export const drawings = {
  ...drawingCrud,
  create(req, res, next) {
    if (req.body?.status !== undefined && req.user?.role !== 'team_lead') {
      return res.status(403).json({ message: 'Only the team lead can set a drawing status.' });
    }
    return drawingCrud.create(req, res, next);
  },
  update(req, res, next) {
    if (req.body?.status !== undefined && req.user?.role !== 'team_lead') {
      return res.status(403).json({ message: 'Only the team lead can set a drawing status.' });
    }
    return drawingCrud.update(req, res, next);
  },
};

export const recruitments = makeCrud(Recruitment, {
  create: recruitmentSchema,
  update: recruitmentUpdateSchema,
  decorate: async (data) => {
    if (data.branch) {
      const { requireActiveBranch } = await import('../utils/branches.js');
      return { ...data, branch: await requireActiveBranch(data.branch) };
    }
    return data;
  },
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    if (req.query.mine === 'true') f.requestedBy = req.user.id;
    return f;
  },
});

export async function createRecruitment(req, res, next) {
  const parsed = recruitmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  if (parsed.data.branch) {
    try {
      const { requireActiveBranch } = await import('../utils/branches.js');
      parsed.data.branch = await requireActiveBranch(parsed.data.branch);
    } catch (err) {
      return res.status(err.status ?? 400).json({ message: err.message });
    }
  }
  try {
    if (parsed.data.project && !await canReadProject(req.user,parsed.data.project)) return res.status(403).json({message:'Project is not assigned to you.'});
    const doc = await Recruitment.create({
      ...parsed.data,
      requestedBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setRecruitmentStatus(req, res, next) {
  const parsed = recruitmentStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Recruitment.findByIdAndUpdate(
      req.params.id,
      { status: parsed.data.status },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

const zTaskExtend = z
  .object({
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid new due date.'),
    reason: z.string().trim().min(1, 'A reason is required.').max(1000),
  })
  .strict();

// 06 Nov 2026: a Team Lead (or the TL chain) extends a task's due date with a
// reason instead of entering the task again. Access follows taskMemberAccess.
export async function extendTaskDueDate(req, res, next) {
  try {
    const parsed = zTaskExtend.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid data.' });
    const task = await Task.findById(req.params.id);
    if (!task || !await canReadProject(req.user, task.project)) return res.status(404).json({ message: 'Task not found.' });
    if (task.status === 'Approved') return res.status(409).json({ message: 'An approved task cannot be extended.' });
    const to = new Date(`${parsed.data.dueDate}T00:00:00.000Z`);
    if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'Enter a valid new due date.' });
    const from = task.dueDate ?? null;
    if (from && to <= new Date(`${new Date(from).toISOString().slice(0, 10)}T00:00:00.000Z`)) {
      return res.status(400).json({ message: 'The new due date must be after the current due date.' });
    }
    task.dueDate = to;
    task.dueDateHistory.push({ from, to, reason: parsed.data.reason, by: req.user.id, at: new Date() });
    // The due-soon / overdue bell alerts fire once per due date; re-arm them.
    task.dueSoonNotifiedAt = undefined;
    task.overdueNotifiedAt = undefined;
    await task.save();
    try {
      const users = await userIdsForEmployees(task.members ?? []);
      if (users.length) {
        const what = [task.stage, task.deliverable].filter(Boolean).join(' · ') || 'Task';
        await notify({
          users, project: task.project, link: { view: 'my-work' }, type: 'task-extended',
          title: `Due date extended: ${what}`,
          detail: `Now due ${parsed.data.dueDate}. ${parsed.data.reason}`,
        });
      }
    } catch { /* The saved extension stays; the bell notice is best effort. */ }
    const item = await Task.findById(task._id).populate([{ path: 'members', select: POP_EMP }, { path: 'project', select: POP_PROJ }]);
    return res.status(200).json({ item });
  } catch (err) {
    return next(err);
  }
}

const TASK_SET_STATUSES = ['Open', 'In Progress', 'Submitted'];

// Assigned members advance their own tasks; TL chain sets any status.
export async function setTaskStatus(req, res, next) {
  const parsed = zTaskStatus.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Not found.' });
    const { User } = await import('../models/User.js');
    const { isSuperRole } = await import('../config/roles.js');
    const me = await User.findById(req.user.id);
    const mine =
      me?.employee != null &&
      task.members.some((m) => m.toString() === me.employee.toString());
    // An assignee can always acknowledge, start and submit their own task, even
    // when the project is not on one of their Team allocations.
    if (!mine && !await canReadProject(req.user, task.project)) return res.status(404).json({ message: 'Not found.' });
    const leadChain = ['team_lead', 'assoc_technical_director', 'technical_director'];
    const canAll =
      isSuperRole(req.user.role) || leadChain.includes(req.user.role);
    if (!mine && !canAll) {
      return res.status(403).json({ message: 'Not assigned to this task.' });
    }
    if (!canAll && !TASK_SET_STATUSES.includes(parsed.data.status)) {
      return res
        .status(403)
        .json({ message: 'Only a Team Lead can approve tasks.' });
    }
    task.status = parsed.data.status;
    await task.save();
    return res.status(200).json({ item: task });
  } catch (err) {
    return next(err);
  }
}

export async function myRevisions(req, res, next) {
  try {
    const { User } = await import('../models/User.js');
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await Revision.find({ assignedTo: me.employee })
      .populate('project', POP_PROJ)
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}
