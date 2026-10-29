import { canReadProject, narrowByProject, projectScopeIds } from '../utils/projectScope.js';
import { nextNumber } from '../models/Counter.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { WORK_ENTRY_STATUSES, WorkEntry } from '../models/WorkEntry.js';
import { EXTRA_HOURS_THRESHOLD, isAttendanceExemptRole } from '../config/attendance.js';
import {
  workEntryDecisionSchema,
  workEntrySchema,
} from '../validation/workEntry.schema.js';
import { User } from '../models/User.js';
import { directorTeams } from '../utils/directorTeams.js';

async function directorEntryScope(user, team) {
  const scoped = await directorTeams(user);
  if (scoped === null) return null;
  return scoped.filter(row => !team || String(row._id) === String(team)).map(row => ({
    project: { $in: row.projects.map(p => p._id) },
    employee: { $in: [row.lead?._id, ...row.members.map(m => m.employee?._id)].filter(Boolean) },
  }));
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
    if (!employee && req.user?.role === 'admin_billing' && !parsed.data.employee) {
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
    if (!projectId && req.user?.role === 'admin_billing') {
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
    if (!isAttendanceExemptRole(req.user?.role)) {
      const entryDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
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
    narrowByProject(filter, 'project', await projectScopeIds(req.user));
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    if (team) {
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

export async function decideWorkEntry(req, res, next) {
  try {
    const parsed = workEntryDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid decision.' });
    }
    const old = await WorkEntry.findById(req.params.id);
    if (!old || !await canReadProject(req.user,old.project)) return res.status(404).json({message:'Work entry not found.'});
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
