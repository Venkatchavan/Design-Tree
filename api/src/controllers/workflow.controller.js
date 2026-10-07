import { z } from 'zod';
import { Deliverable, DeliverableLog } from '../models/Deliverable.js';
import { TASK_STATUSES } from '../models/Task.js';

const zTaskStatus = z
  .object({ status: z.enum(TASK_STATUSES) })
  .strict();
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

export const tasks = makeCrud(Task, {
  create: taskSchema,
  update: taskUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    if (req.query.member) f.members = req.query.member;
    return f;
  },
  populate: [
    { path: 'members', select: POP_EMP },
    { path: 'project', select: POP_PROJ },
  ],
});

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
    by,
  });
}

export const deliverables = makeCrud(Deliverable, {
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
  ],
});

export async function createDeliverable(req, res, next) {
  const parsed = deliverableSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Deliverable.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    await logDeliverable(
      doc.project,
      'Created',
      { ...parsed.data, details: `Due ${parsed.data.dueDate ?? '—'}` },
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
    const items = await DeliverableLog.find(filter)
      .populate('project', POP_PROJ)
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export const revisions = makeCrud(Revision, {
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

export async function createRevision(req, res, next) {
  const parsed = revisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const emailLog = [];
    if (parsed.data.notify && parsed.data.assignedTo) {
      const { Employee } = await import('../models/Employee.js');
      const assignee = await Employee.findById(parsed.data.assignedTo);
      if (assignee?.email) {
        // Logged only — no real mail service is connected (spec §7).
        emailLog.push(
          `Notified ${assignee.firstName} ${assignee.lastName} <${assignee.email}> — revision logged (queued, not sent)`,
        );
      }
    }
    const doc = await Revision.create({
      ...parsed.data,
      emailLog,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setRevisionStatus(req, res, next) {
  const parsed = revisionStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const patch = { status: parsed.data.status };
    if (parsed.data.status === 'Resubmitted')
      patch.resubmittedAt = new Date();
    if (parsed.data.status === 'Cleared') patch.clearedAt = new Date();
    const doc = await Revision.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const drawings = makeCrud(Drawing, {
  create: drawingSchema,
  update: drawingUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.stage) f.stage = req.query.stage;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export const recruitments = makeCrud(Recruitment, {
  create: recruitmentSchema,
  update: recruitmentUpdateSchema,
  filters: (req) => {
    const f = {};
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
  try {
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
