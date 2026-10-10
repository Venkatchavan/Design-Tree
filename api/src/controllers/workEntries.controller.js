import { nextNumber } from '../models/Counter.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { WorkEntry } from '../models/WorkEntry.js';
import {
  workEntryDecisionSchema,
  workEntrySchema,
} from '../validation/workEntry.schema.js';
import { User } from '../models/User.js';

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
    const project = projectId ? await Project.findById(projectId) : null;
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const entry = await WorkEntry.create({
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
    const [items, total] = await Promise.all([
      WorkEntry.find(filter)
        .populate('employee', 'firstName lastName empId designation department branch')
        .populate('project', 'name code branch')
        .sort({ date: -1 })
        .limit(200),
      WorkEntry.countDocuments(filter),
    ]);
    return res.status(200).json({ items, total });
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
