import { canReadProject, narrowByProject, projectScopeIds } from '../utils/projectScope.js';
import { nextNumber } from '../models/Counter.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { WORK_ENTRY_STATUSES, WorkEntry } from '../models/WorkEntry.js';
import { EXTRA_HOURS_THRESHOLD, isAttendanceExemptRole, istDayKey } from '../config/attendance.js';
import { AttendanceDay } from '../models/AttendanceDay.js';
import { isWorkingDay, notifyExtraHoursRequest } from './attendance.controller.js';
import {
  workEntryDecisionSchema,
  workEntrySchema,
} from '../validation/workEntry.schema.js';
import { User } from '../models/User.js';
import { directorTeams } from '../utils/directorTeams.js';
import { reportingEmployeeIds } from '../utils/reportingEmployees.js';

// Roles that use the simple hours + notes update form (no project picker): the
// controller falls back to the login email's employee and the Internal /
// non-billable project for them.
const SIMPLE_UPDATE_ROLES = ['admin_billing', 'receptionist'];

export async function directorEntryScope(user, team) {
  const scoped = await directorTeams(user);
  if (scoped === null) return null;
  return scoped.filter(row => !team || String(row._id) === String(team)).map(row => ({
    project: { $in: row.projects.map(p => p._id) },
    employee: { $in: [row.lead?._id, ...row.members.map(m => m.employee?._id)].filter(Boolean) },
  }));
}

// A work-update extra-hours reason goes to the same approval queue as the
// sign-out one (the day's AttendanceDay), so the reporting TL / PTL / head
// approves or declines it with a reason. A request already decided for the
// day is left alone; a pending one takes the latest reason and day total.
async function queueExtraHours(employeeId, day, userId) {
  try {
    let doc = await AttendanceDay.findOne({ employee: employeeId, date: day.dayKey });
    if (!doc) doc = new AttendanceDay({ employee: employeeId, date: day.dayKey, workingDay: day.workingDay, decidedBy: userId });
    if (doc.extraHoursStatus === 'approved' || doc.extraHoursStatus === 'declined') return;
    doc.extraHoursReason = day.reason;
    doc.extraHours = Math.max(day.hours, doc.extraHoursStatus === 'pending' ? (doc.extraHours ?? 0) : 0);
    doc.extraHoursStatus = 'pending';
    doc.extraHoursSource = 'work-update';
    doc.extraHoursDecisionReason = null;
    doc.decidedAt = new Date();
    await doc.save();
    await notifyExtraHoursRequest(doc);
  } catch { /* the work entry is saved; the approval queue is best effort */ }
}

async function resolveEmployee(req, explicitId) {
  if (explicitId) {
    const found = await Employee.findById(explicitId);
    return found ?? null;
  }
  const me = await User.findById(req.user.id);
  if (!me?.employee) return null;
  return Employee.findById(me.employee);
}

export async function createWorkEntry(req, res, next) {
  try {
    const parsed = workEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid work entry data.' });
    }
    let employee = await resolveEmployee(req, parsed.data.employee);
    if (!employee && SIMPLE_UPDATE_ROLES.includes(req.user?.role) && !parsed.data.employee) {
      // Admins often have no linked employee record: fall back to matching
      // an employee by the login email so the simple admin update form works.
      const me = await User.findById(req.user.id);
      if (me?.email) {
        employee = await Employee.findOne({ email: me.email });
      }
    }
    if (!employee) {
      return res.status(400).json({
        message: 'No linked employee record. Pass an employee id.',
      });
    }
    let projectId = parsed.data.project;
    if (!projectId && SIMPLE_UPDATE_ROLES.includes(req.user?.role)) {
      // The admin update form carries no project: log against the
      // Internal / non-billable project when one exists.
      const fallback = await Project.findOne({ name: /internal \/ non-billable/i });
      if (fallback) projectId = fallback._id;
    }
    if (projectId && !await canReadProject(req.user, projectId)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    for (const row of parsed.data.otherHours ?? []) if (!await canReadProject(req.user, row.project)) return res.status(403).json({ message: 'Other project is not assigned to you.' });
    const project = projectId ? await Project.findById(projectId) : null;
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    // Extra-hours gate: the day's total (existing entries + this one) over
    // the threshold needs a reason, so hours can't be split across entries
    // to dodge the single-entry schema check.
    let extraHoursDay = null;
    if (!isAttendanceExemptRole(req.user?.role)) {
      const entryDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
      const rawDate = typeof req.body?.date === 'string' ? req.body.date : '';
      const dayKey = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : istDayKey(entryDate);
      const workingDay = await isWorkingDay(dayKey);
      const dayStart = new Date(entryDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(entryDate);
      dayEnd.setHours(23, 59, 59, 999);
      const existing = await WorkEntry.find({
        employee: employee._id,
        date: { $gte: dayStart, $lte: dayEnd },
      }).select('hours otherHours');
      const existingTotal = existing.reduce(
        (s, e) =>
          s +
          (e.hours ?? 0) +
          (e.otherHours ?? []).reduce((a, o) => a + (o.hours ?? 0), 0),
        0,
      );
      const newTotal =
        (parsed.data.hours ?? 0) +
        (parsed.data.otherHours ?? []).reduce((s, o) => s + (o.hours ?? 0), 0);
      if (
        existingTotal + newTotal > EXTRA_HOURS_THRESHOLD &&
        !parsed.data.extraHoursReason?.trim()
      ) {
        return res.status(400).json({
          message: `A reason is required for extra hours (over ${EXTRA_HOURS_THRESHOLD}h in a day).`,
        });
      }
      // Any work on a Sunday / holiday is extra hours and needs a reason.
      if (!workingDay && !parsed.data.extraHoursReason?.trim()) {
        return res.status(400).json({ message: 'A reason is required for working on a Sunday or holiday.' });
      }
      const dayTotal = existingTotal + newTotal;
      if (parsed.data.extraHoursReason?.trim() && (!workingDay || dayTotal > EXTRA_HOURS_THRESHOLD)) {
        extraHoursDay = {
          dayKey,
          workingDay,
          reason: parsed.data.extraHoursReason.trim(),
          hours: Math.round((workingDay ? Math.max(0, dayTotal - EXTRA_HOURS_THRESHOLD) : dayTotal) * 10) / 10,
        };
      }
    }
    const entry = await WorkEntry.create({
      createdBy: req.user.id,
      employee: employee._id,
      project: project._id,
      stage: parsed.data.stage ?? project.currentStage,
      date: parsed.data.date ?? new Date(),
      hours: parsed.data.hours,
      type: parsed.data.type ?? 'Regular',
      notes: parsed.data.notes,
      wuNo: await nextNumber('wu', 'WU'),
      category: parsed.data.category,
      deliverable: parsed.data.deliverable,
      taskActivity: parsed.data.taskActivity,
      drawing: parsed.data.drawing,
      progressPct: parsed.data.progressPct,
      otherHours: parsed.data.otherHours,
      extraHoursReason: parsed.data.extraHoursReason?.trim() || undefined,
    });
    if (extraHoursDay) await queueExtraHours(employee._id, extraHoursDay, req.user.id);
    return res.status(201).json({ entry });
  } catch (err) {
    return next(err);
  }
}

export async function listWorkEntries(req, res, next) {
  try {
    const { employee, project, team, status, from, to, mine } = req.query;
    const filter = {};
    if (mine === 'true') {
      const me = await User.findById(req.user.id);
      if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
      filter.employee = me.employee;
    } else if (employee) {
      filter.employee = employee;
    }
    if (project) filter.project = project;
    // A TL's team = saved Team members + their reporting chain (as the
    // work-hours report does), on any project they log against; so "Team
    // work items" is not empty when the team has no Team document.
    const leadTeamView = req.user?.role === 'team_lead' && mine !== 'true' && !employee;
    let leadTeam = null;
    if (leadTeamView) {
      const me = await User.findById(req.user.id).select('employee').lean();
      const own = String(me?.employee ?? '');
      const ids = new Set(await reportingEmployeeIds(req.user));
      const teams = team
        ? await Team.find({ _id: team }).lean()
        : own ? await Team.find({ lead: me.employee, active: { $ne: false } }).lean() : [];
      if (team && teams.length === 0) return res.status(404).json({ message: 'Team not found.' });
      for (const t of teams) for (const m of t.members ?? []) ids.add(String(m.employee));
      ids.delete(own);
      leadTeam = [...ids];
    } else {
      narrowByProject(filter, 'project', await projectScopeIds(req.user));
    }
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    if (leadTeam) {
      filter.employee = { $in: leadTeam };
    } else if (team) {
      const t = await Team.findById(team);
      if (!t) return res.status(404).json({ message: 'Team not found.' });
      filter.employee = { $in: t.members.map((m) => m.employee) };
    }
    const scope = await directorEntryScope(req.user, team);
    if (scope !== null) {
      if (scope.length) filter.$and = [{ $or: scope }];
      else filter._id = { $in: [] };
    }
    const [items, total, ...statusCounts] = await Promise.all([
      WorkEntry.find(filter)
        .populate('employee', 'firstName lastName empId designation department branch')
        .populate('project', 'name code branch')
        .sort({ date: -1 })
        .limit(200),
      WorkEntry.countDocuments(filter),
      ...(mine === 'true'
        ? WORK_ENTRY_STATUSES.map((entryStatus) => WorkEntry.countDocuments({ ...filter, status: entryStatus }))
        : []),
    ]);
    return res.status(200).json({
      items,
      total,
      ...(mine === 'true'
        ? { statusCounts: Object.fromEntries(WORK_ENTRY_STATUSES.map((entryStatus, index) => [entryStatus, statusCounts[index]])) }
        : {}),
    });
  } catch (err) {
    return next(err);
  }
}

async function isLeadTeamMember(user, employeeId) {
  const me = await User.findById(user.id).select('employee').lean();
  if (!me?.employee || String(me.employee) === String(employeeId)) return false;
  if ((await reportingEmployeeIds(user)).includes(String(employeeId))) return true;
  return !!await Team.exists({ lead: me.employee, active: { $ne: false }, 'members.employee': employeeId });
}

export async function decideWorkEntry(req, res, next) {
  try {
    const parsed = workEntryDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid decision.' });
    }
    const old = await WorkEntry.findById(req.params.id);
    // A TL may act on their own team's items (same scope as Team work items),
    // even on a project outside their allocation.
    const ownTeamItem = old && req.user?.role === 'team_lead' && await isLeadTeamMember(req.user, old.employee);
    if (!old || (!ownTeamItem && !await canReadProject(req.user,old.project))) return res.status(404).json({message:'Work entry not found.'});
    const scope = await directorEntryScope(req.user);
    if (scope !== null && (!scope.length || !await WorkEntry.exists({ _id: old._id, $or: scope }))) {
      return res.status(404).json({ message: 'Work entry not found.' });
    }
    const entry = await WorkEntry.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        remark: parsed.data.remark,
        decidedBy: req.user.id,
        decidedAt: new Date(),
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!entry)
      return res.status(404).json({ message: 'Work entry not found.' });
    return res.status(200).json({ entry });
  } catch (err) {
    return next(err);
  }
}
