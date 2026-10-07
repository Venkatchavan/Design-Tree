import { isSuperRole } from '../config/roles.js';
import { Employee } from '../models/Employee.js';
import {
  INVITE_RESPONSES,
  Meeting,
} from '../models/Meeting.js';
import { User } from '../models/User.js';
import {
  actionSchema,
  actionStatusSchema,
  attendanceSchema,
  inviteResponseSchema,
  meetingSchema,
  meetingUpdateSchema,
  momSchema,
} from '../validation/phase4.schema.js';

const POP_PROJ = 'name code branch';
const POP_EMP = 'firstName lastName empId designation';

async function myEmployeeId(userId) {
  const me = await User.findById(userId);
  return me?.employee?.toString?.() ?? null;
}

export async function listMeetings(req, res, next) {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.mine === 'true') {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.status(200).json({ items: [], total: 0 });
      filter['invites.employee'] = empId;
    }
    const items = await Meeting.find(filter)
      .populate('project', POP_PROJ)
      .populate('invites.employee', POP_EMP)
      .populate('attendance.employee', POP_EMP)
      .populate('actions.owner', POP_EMP)
      .sort({ date: -1 })
      .limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function getMeeting(req, res, next) {
  try {
    const doc = await Meeting.findById(req.params.id)
      .populate('project', POP_PROJ)
      .populate('invites.employee', POP_EMP)
      .populate('attendance.employee', POP_EMP)
      .populate('participants.employee', POP_EMP)
      .populate('actions.owner', POP_EMP);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

function responsibleFor(services) {
  const set = new Set((services ?? []).map((s) => s.toLowerCase()));
  const smepf = ['structural', 'mechanical', 'electrical', 'plumbing', 'fire'];
  const hasAll = smepf.every((s) => set.has(s));
  if (hasAll) return 'Project SPOC (SMEPF services)';
  if (set.size === 1 && set.has('structural')) return 'Structural Design Lead';
  return 'Project SPOC with service leads';
}

export async function createMeeting(req, res, next) {
  const parsed = meetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const category = parsed.data.category ?? 'Scheduled';
    const invites = (parsed.data.participants ?? [])
      .map((p) => p.employee)
      .filter(Boolean)
      .map((employee) => ({ employee, response: 'Pending' }));
    const doc = await Meeting.create({
      ...parsed.data,
      category,
      status: category === 'Sudden' ? 'Held' : 'Scheduled',
      invites: category === 'Scheduled' ? invites : [],
      responsible:
        parsed.data.responsible ?? responsibleFor(parsed.data.services),
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function updateMeeting(req, res, next) {
  const parsed = meetingUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (doc.status === 'Held' && parsed.data.status !== 'Held') {
      return res
        .status(422)
        .json({ message: 'Held meetings cannot be reopened.' });
    }
    Object.assign(doc, parsed.data);
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// Reschedule keeps the original date (R11); only before held.
export async function rescheduleMeeting(req, res, next) {
  try {
    const { date, startTime, endTime } = req.body ?? {};
    if (!date) return res.status(400).json({ message: 'New date is required.' });
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (doc.status === 'Held') {
      return res
        .status(422)
        .json({ message: 'Only meetings before they are held can be rescheduled.' });
    }
    if (!doc.originalDate) doc.originalDate = doc.date;
    doc.date = new Date(date);
    if (startTime !== undefined) doc.startTime = startTime;
    if (endTime !== undefined) doc.endTime = endTime;
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function markHeld(req, res, next) {
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    doc.status = 'Held';
    // Seed attendance from invitees; SPOC corrects it afterwards.
    if (doc.attendance.length === 0) {
      doc.attendance = doc.invites.map((i) => ({
        employee: i.employee,
        present: true,
      }));
    }
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function cancelMeeting(req, res, next) {
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (doc.status === 'Held') {
      return res
        .status(422)
        .json({ message: 'Held meetings cannot be cancelled.' });
    }
    doc.status = 'Cancelled';
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

async function requireHeld(doc, res) {
  if (doc.status !== 'Held') {
    res.status(422).json({
      message: 'Attendance, MOM and action items need a held meeting (R7).',
    });
    return false;
  }
  return true;
}

export async function saveAttendance(req, res, next) {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (!(await requireHeld(doc, res))) return undefined;
    doc.attendance = parsed.data.attendance;
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function saveMom(req, res, next) {
  const parsed = momSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (!(await requireHeld(doc, res))) return undefined;
    if (parsed.data.mom !== undefined) doc.mom = parsed.data.mom;
    if (parsed.data.momDoc !== undefined) doc.momDoc = parsed.data.momDoc;
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function addAction(req, res, next) {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (!(await requireHeld(doc, res))) return undefined;
    doc.actions.push(parsed.data);
    await doc.save();
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// E9: only the owner (or superuser) changes an action's status.
export async function setActionStatus(req, res, next) {
  const parsed = actionStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    const action = doc.actions.id(req.params.actionId);
    if (!action) return res.status(404).json({ message: 'Action not found.' });
    const empId = await myEmployeeId(req.user.id);
    const mine =
      empId != null && action.owner?.toString?.() === empId.toString();
    if (!mine && !isSuperRole(req.user.role)) {
      return res.status(403).json({
        message: 'Only the assigned owner can change this action item.',
      });
    }
    action.status = parsed.data.status;
    // R10/E10: completion date set automatically, cleared on reopen.
    action.completedAt =
      parsed.data.status === 'Completed' ? new Date() : undefined;
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// Employee availability response (E4–E6).
export async function respondInvite(req, res, next) {
  const parsed = inviteResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res
      .status(400)
      .json({ message: issue?.message ?? 'Invalid response.' });
  }
  try {
    const doc = await Meeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (doc.status !== 'Scheduled' || doc.category !== 'Scheduled') {
      return res.status(422).json({
        message: 'Availability is asked only for upcoming scheduled meetings.',
      });
    }
    const empId = await myEmployeeId(req.user.id);
    const invite = doc.invites.find(
      (i) => i.employee.toString() === String(empId),
    );
    if (!invite && !isSuperRole(req.user.role)) {
      return res.status(403).json({ message: 'You are not invited.' });
    }
    const target = invite ?? doc.invites[0];
    if (!target) return res.status(404).json({ message: 'No invite found.' });
    if (!INVITE_RESPONSES.includes(parsed.data.response)) {
      return res.status(400).json({ message: 'Invalid response.' });
    }
    target.response = parsed.data.response;
    target.reason = parsed.data.reason;
    target.note = parsed.data.note;
    target.respondedAt = new Date();
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function absenceLog(req, res, next) {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    const meetings = await Meeting.find(filter)
      .populate('invites.employee', POP_EMP)
      .populate('project', POP_PROJ)
      .sort({ date: -1 })
      .limit(200);
    const rows = [];
    for (const m of meetings) {
      for (const i of m.invites) {
        if (i.response === 'Not Available') {
          rows.push({
            meeting: m._id.toString(),
            title: m.title,
            project: m.project,
            date: m.date,
            employee: i.employee,
            reason: i.reason,
            note: i.note,
            respondedAt: i.respondedAt,
          });
        }
      }
    }
    return res.status(200).json({ items: rows, total: rows.length });
  } catch (err) {
    return next(err);
  }
}
