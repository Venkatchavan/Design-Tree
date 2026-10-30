import { addHours } from '../utils/workHours.js';
import { workDateFilter, dayStart, workDate } from '../utils/workDates.js';
import { canReadProject, narrowByProject, projectScopeIds } from '../utils/projectScope.js';
import { Employee } from '../models/Employee.js';
import { SpocEntry } from '../models/SpocEntry.js';
import { User } from '../models/User.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { spocEntrySchema } from '../validation/phase2.schema.js';
import { MAN_HOUR_EXEMPT_ROLES } from '../config/roles.js';

function todayRange() {
  const start = dayStart(workDate());
  return { start, now: new Date() };
}

async function resolveEmployee(req, explicitId) {
  if (explicitId) return Employee.findById(explicitId);
  const me = await User.findById(req.user.id);
  if (!me?.employee) return null;
  return Employee.findById(me.employee);
}

export async function createSpocEntry(req, res, next) {
  try {
    const parsed = spocEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    const me = await User.findById(req.user.id).select('employee');
    if (parsed.data.employee && String(parsed.data.employee) !== String(me?.employee)) return res.status(403).json({ message: 'Log your own daily work.' });
    if (!await canReadProject(req.user, parsed.data.project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    const employee = await resolveEmployee(req, parsed.data.employee);
    if (!employee) {
      return res.status(400).json({
        message: 'No linked employee record. Pass an employee id.',
      });
    }
    const doc = await SpocEntry.create({
      ...parsed.data,
      date: parsed.data.date ?? new Date(),
      employee: employee._id,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function listSpocEntries(req, res, next) {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.mine !== 'true') narrowByProject(filter, 'project', await projectScopeIds(req.user));
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.mine === 'true') {
      const me = await User.findById(req.user.id);
      if (!me?.employee)
        return res.status(200).json({ items: [], total: 0 });
      filter.employee = me.employee;
    }
    try { const dateFilter=workDateFilter(req.query); if(dateFilter) filter.date=dateFilter; }
    catch(err) { return res.status(400).json({message:err.message}); }
    const limit=Math.min(200,Math.max(1,Number(req.query.limit)||100));
    const offset=Math.max(0,Number(req.query.offset)||0);
    const total=await SpocEntry.countDocuments(filter);
    const items = await SpocEntry.find(filter)
      .populate('employee', 'firstName lastName empId')
      .populate('project', 'name code branch')
      .sort({ date: -1, _id: -1 })
      .skip(offset).limit(limit);
    return res.status(200).json({ items, total, offset, limit });
  } catch (err) {
    return next(err);
  }
}

// Sign-out gate data (§2.6): has this user recorded man-hours today?
// Directive roles (founding → assoc technical) + externals + superuser are exempt:
// no own entry required, view-only for others' hours.
export async function manHourStatus(req, res, next) {
  try {
    const role = req.user.role;
    if (MAN_HOUR_EXEMPT_ROLES.includes(role)) {
      return res
        .status(200)
        .json({ required: false, logged: true, hours: 0 });
    }
    const me = await User.findById(req.user.id);
    if (!me?.employee) {
      return res
        .status(200)
        .json({ required: true, logged: false, hours: 0 });
    }
    const { start, now } = todayRange();
    const [entries, spoc] = await Promise.all([
      WorkEntry.find({
        employee: me.employee,
        date: { $gte: start, $lte: now },
      }),
      SpocEntry.find({
        employee: me.employee,
        date: { $gte: start, $lte: now },
      }),
    ]);
    const hours = addHours(
      entries.reduce((sum,e) => addHours(sum,e.hours,...(e.otherHours??[]).map(row=>row.hours)),0),
      spoc.reduce((sum,e) => addHours(sum,e.totalHours),0),
    );
    return res
      .status(200)
      .json({ required: true, logged: hours > 0, hours });
  } catch (err) {
    return next(err);
  }
}

export async function myAllocations(req, res, next) {
  try {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await SpocAllocation.find({ coordinator: me.employee })
      .populate('project', 'name code branch currentStage status');
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

// Admin/DMH visibility into allocations (Project Team → Admin sharing).
export async function listAllocations(req, res, next) {
  try {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.status) filter.status = req.query.status;
    narrowByProject(filter, 'project', await projectScopeIds(req.user));
    const items = await SpocAllocation.find(filter)
      .populate('project', 'name code branch currentStage status')
      .populate('coordinator', 'firstName lastName empId designation')
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function listAllAllocations(req, res, next) {
  try {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.status) filter.status = req.query.status;
    const items = await SpocAllocation.find(filter)
      .populate('project', 'name code branch currentStage status')
      .populate('coordinator', 'firstName lastName empId designation')
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

// Proposed → Approved gate for the Admin-assigns-SPOC flow. The SPOC
// self-record path (recordAllocation) stays force-Approved so the
// initiation walkthrough expectation is unchanged.
export async function setAllocationStatus(req, res, next) {
  try {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const { status } = req.body ?? {};
    if (!['Proposed', 'Approved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const doc = await SpocAllocation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Allocation not found.' });
    if (status === 'Approved') {
      try {
        const { userIdsForEmployees, notify } = await import('../models/Notification.js');
        const users = await userIdsForEmployees([doc.coordinator]);
        if (users.length) {
          await notify({
            users,
            project: doc.project,
            link: { view: 'project-detail', id: String(doc.project) },
            title: 'Project assignment approved',
            detail: 'This project is now available in your SPOC dashboard.',
            type: 'spoc-allocation-approved',
          });
        }
      } catch (err) {
        // Keep assignment approval successful if its notification cannot be delivered.
        console.error('Failed to notify SPOC about project assignment:', err);
      }
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// Team-proposed allocation (lands as Proposed for DMH/Admin approval).
export async function proposeAllocation(req, res, next) {
  try {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const { project, coordinator, services } = req.body ?? {};
    if (!project || !coordinator) {
      return res
        .status(400)
        .json({ message: 'project and coordinator are required.' });
    }
    if (!await canReadProject(req.user,project)) return res.status(403).json({message:'Project is not assigned to you.'});
    const doc = await SpocAllocation.findOneAndUpdate(
      { project, coordinator },
      {
        project,
        coordinator,
        services: services ?? [],
        status: 'Proposed',
        createdBy: req.user.id,
      },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Allocation already recorded.' });
    }
    return next(err);
  }
}

export async function recordAllocation(req, res, next) {
  try {
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const { project, coordinator, services } = req.body ?? {};
    if (!project || !coordinator) {
      return res
        .status(400)
        .json({ message: 'project and coordinator are required.' });
    }
    if (!await canReadProject(req.user,project)) return res.status(403).json({message:'Project is not assigned to you.'});
    const doc = await SpocAllocation.findOneAndUpdate(
      { project, coordinator },
      {
        project,
        coordinator,
        services: services ?? [],
        status: 'Approved',
        createdBy: req.user.id,
      },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Allocation already recorded.' });
    }
    return next(err);
  }
}
