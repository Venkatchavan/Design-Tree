import { AllowanceRequest } from '../models/AllowanceRequest.js';
import { Employee } from '../models/Employee.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Team } from '../models/Team.js';
import { TravelRequest } from '../models/TravelRequest.js';
import { User } from '../models/User.js';
import { makeCrud } from '../utils/crud.js';
import {
  allowanceDecisionSchema,
  allowanceSchema,
  holidaySchema,
  leaveDecisionSchema,
  leaveSchema,
  travelDecisionSchema,
  travelSchema,
  travelSettleSchema,
} from '../validation/phase4.schema.js';

const POP_EMP = 'firstName lastName empId designation department branch';
const POP_PROJ = 'name code';

async function resolveEmployee(req, explicitId) {
  if (explicitId) return Employee.findById(explicitId);
  const me = await User.findById(req.user.id);
  if (!me?.employee) return null;
  return Employee.findById(me.employee);
}

async function teamMemberIds(userId) {
  const me = await User.findById(userId);
  if (!me?.employee) return [];
  const teams = await Team.find({
    $or: [{ lead: me.employee }, { 'members.employee': me.employee }],
  });
  const ids = new Set();
  for (const t of teams) {
    if (t.lead) ids.add(t.lead.toString());
    for (const m of t.members) ids.add(m.employee.toString());
  }
  return [...ids];
}

export const leaves = makeCrud(LeaveRequest, {
  create: leaveSchema,
  filters: (req) => {
    const f = {};
    if (req.query.employee) f.employee = req.query.employee;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'employee', select: POP_EMP }],
});

export async function createLeave(req, res, next) {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const employee = await resolveEmployee(req, parsed.data.employee);
    if (!employee) {
      return res.status(400).json({ message: 'No linked employee record.' });
    }
    const doc = await LeaveRequest.create({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function myLeaves(req, res, next) {
  try {
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await LeaveRequest.find({ employee: me.employee })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function approvalQueue(_req, res, next) {
  // Approver-scoped pending lists are resolved client-side from teams;
  // this endpoint returns every pending item for approver roles.
  try {
    const [leave, travel, allowance] = await Promise.all([
      LeaveRequest.find({ status: 'Pending' })
        .populate('employee', POP_EMP)
        .sort({ createdAt: -1 })
        .limit(100),
      TravelRequest.find({ status: 'Pending' })
        .populate('employee', POP_EMP)
        .populate('project', POP_PROJ)
        .sort({ createdAt: -1 })
        .limit(100),
      AllowanceRequest.find({ status: 'Pending' })
        .populate('employee', POP_EMP)
        .populate('project', POP_PROJ)
        .sort({ createdAt: -1 })
        .limit(100),
    ]);
    return res.status(200).json({ leave, travel, allowance });
  } catch (err) {
    return next(err);
  }
}

export async function decideLeave(req, res, next) {
  const parsed = leaveDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        remarks: parsed.data.remarks,
        decidedBy: req.user.id,
        decidedAt: new Date(),
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const travels = makeCrud(TravelRequest, {
  create: travelSchema,
  filters: (req) => {
    const f = {};
    if (req.query.employee) f.employee = req.query.employee;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [
    { path: 'employee', select: POP_EMP },
    { path: 'project', select: POP_PROJ },
  ],
});

export async function createTravel(req, res, next) {
  const parsed = travelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const employee = await resolveEmployee(req, parsed.data.employee);
    if (!employee) {
      return res.status(400).json({ message: 'No linked employee record.' });
    }
    const doc = await TravelRequest.create({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function myTravels(req, res, next) {
  try {
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await TravelRequest.find({ employee: me.employee })
      .populate('project', POP_PROJ)
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function decideTravel(req, res, next) {
  const parsed = travelDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await TravelRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        remarks: parsed.data.remarks,
        decidedBy: req.user.id,
        decidedAt: new Date(),
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function settleTravel(req, res, next) {
  const parsed = travelSettleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const existing = await TravelRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found.' });
    // findByIdAndUpdate skips validate hooks: recompute totals explicitly.
    const merged = { ...existing.toObject(), ...parsed.data };
    const actual =
      (merged.fare ?? 0) +
      (merged.foodPerDiem ?? 0) +
      (merged.localConveyance ?? 0) +
      (merged.misc ?? 0);
    const doc = await TravelRequest.findByIdAndUpdate(
      req.params.id,
      {
        ...parsed.data,
        actualExpense: actual > 0 ? actual : (merged.actualExpense ?? 0),
        balance: (merged.advanceReceived ?? 0) - (actual > 0 ? actual : 0),
        settlementDate: parsed.data.settlementDate ?? new Date(),
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const allowances = makeCrud(AllowanceRequest, {
  create: allowanceSchema,
  filters: (req) => {
    const f = {};
    if (req.query.employee) f.employee = req.query.employee;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [
    { path: 'employee', select: POP_EMP },
    { path: 'project', select: POP_PROJ },
  ],
});

export async function createAllowance(req, res, next) {
  const parsed = allowanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const employee = await resolveEmployee(req, parsed.data.employee);
    if (!employee) {
      return res.status(400).json({ message: 'No linked employee record.' });
    }
    const doc = await AllowanceRequest.create({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function myAllowances(req, res, next) {
  try {
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await AllowanceRequest.find({ employee: me.employee })
      .populate('project', POP_PROJ)
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function decideAllowance(req, res, next) {
  const parsed = allowanceDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await AllowanceRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        remarks: parsed.data.remarks,
        decidedBy: req.user.id,
        decidedAt: new Date(),
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function teamScopeIds(req, res, next) {
  // Employee ids the caller may review (own teams + self).
  try {
    const me = await User.findById(req.user.id);
    const ids = new Set(await teamMemberIds(req.user.id));
    if (me?.employee) ids.add(me.employee.toString());
    return res.status(200).json({ ids: [...ids] });
  } catch (err) {
    return next(err);
  }
}

export const holidays = makeCrud(Holiday, {
  create: holidaySchema,
  filters: () => ({}),
});

export async function listHolidays(req, res, next) {
  try {
    const filter = {};
    if (req.query.year) {
      const y = Number(req.query.year);
      filter.date = {
        $gte: new Date(y, 0, 1),
        $lte: new Date(y, 11, 31, 23, 59, 59),
      };
    }
    const items = await Holiday.find(filter).sort({ date: 1 }).limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}
