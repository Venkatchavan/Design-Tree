import { AllowanceRequest } from '../models/AllowanceRequest.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { Employee } from '../models/Employee.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Team } from '../models/Team.js';
import { TravelRequest } from '../models/TravelRequest.js';
import { User } from '../models/User.js';
import { makeCrud } from '../utils/crud.js';
import {
  FLOW_APPROVED,
  STAGE_LABELS,
  buildFlowStages,
  isPendingFlow,
  nextStage,
  stageForRole,
} from '../config/approvalFlow.js';
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

// Requester's login for decision notifications (requester-only relevance).
async function requesterUserIds(doc) {
  try {
    if (!doc?.employee) return [];
    return await userIdsForEmployees([doc.employee]);
  } catch {
    return [];
  }
}

function empShort(e) {
  if (!e || typeof e !== 'object') return '';
  return [e.firstName, e.lastName].filter(Boolean).join(' ');
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

// A requester has a Team Lead step only when they actually sit in a team
// led by somebody else. Directive roles report straight to HR.
async function requesterHasTeamLead(employeeId) {
  if (!employeeId) return false;
  const team = await Team.findOne({
    'members.employee': employeeId,
    lead: { $ne: null },
  }).lean();
  if (!team) return false;
  return String(team.lead) !== String(employeeId);
}

// Employee id -> the login roles attached to that employee, used to keep
// directors out of the Team Lead step even if they sit in a team roster.
async function requesterRoles(employeeId) {
  if (!employeeId) return [];
  const users = await User.find({ employee: employeeId }).select('role').lean();
  return users.map((u) => u.role);
}

// Snapshot the chain onto the document at creation so every later status
// read is a pure function of the stage decisions.
async function attachFlowStages(doc, employee) {
  const inATeam = await requesterHasTeamLead(employee?._id);
  const roles = await requesterRoles(employee?._id);
  const directed = roles.length > 0 && roles.every((r) => isDirectiveRole(r));
  doc.flowStages = buildFlowStages({
    hasTeamLead: inATeam && !directed,
    department: employee?.department ?? '',
  });
  if (!doc.stages) doc.stages = {};
  return doc.flowStages;
}

// Directive roles report straight to HR — never via a Team Lead.
function isDirectiveRole(role) {
  return [
    'founding_director',
    'working_director',
    'admin_billing',
    'hr',
    'executive_director',
    'associate_director',
    'technical_director',
    'assoc_technical_director',
  ].includes(role);
}

export const leaves = makeCrud(LeaveRequest, {
  create: leaveSchema,
  filters: (req) => {
    const f = {};
    if (req.query.employee) f.employee = req.query.employee;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [
    { path: 'employee', select: POP_EMP },
    { path: 'decidedBy', select: 'name email' },
  ],
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
    const doc = new LeaveRequest({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    await attachFlowStages(doc, employee);
    await doc.save();
    notify({
      roles: ['hr', 'admin_billing'],
      link: { view: 'leave', id: String(doc._id) },
      title: `Leave request: ${empShort(employee) || 'team member'}`,
      detail: `${String(parsed.data.from ?? '').slice(0, 10)} → ${String(parsed.data.to ?? '').slice(0, 10)} · ${parsed.data.leaveType ?? ''}`,
      type: 'leave',
    }).catch(() => {});
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
      .populate('decidedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

// Queue for the Approvals tab. Scope is enforced server-side: a Team Lead
// only ever sees their own teams, Finance only sees Finance-department
// leave, and HR/directors see everything (directors read-only in the UI).
export async function approvalQueue(req, res, next) {
  try {
    const role = req.user?.role;
    const scope = stageForRole(role) === 'tl' ? await teamMemberIds(req.user.id) : null;
    const pendingFlow = { status: { $nin: ['Approved', 'Rejected'] } };

    const leaveQuery = { ...pendingFlow };
    const travelQuery = { ...pendingFlow };
    if (scope) {
      leaveQuery.employee = { $in: scope };
      travelQuery.employee = { $in: scope };
    } else if (role === 'finance') {
      // Finance clears the final step for its own department's leave only
      // (§4.14); its travel queue spans every department.
      leaveQuery.employee = await financeEmployeeIds();
    }

    const [leave, travel, allowance] = await Promise.all([
      LeaveRequest.find(leaveQuery)
        .populate('employee', POP_EMP)
        .populate('stages.tl.by', 'name email')
        .populate('stages.hr.by', 'name email')
        .populate('stages.finance.by', 'name email')
        .sort({ createdAt: -1 })
        .limit(100),
      TravelRequest.find(travelQuery)
        .populate('employee', POP_EMP)
        .populate('project', POP_PROJ)
        .populate('stages.tl.by', 'name email')
        .populate('stages.hr.by', 'name email')
        .populate('stages.finance.by', 'name email')
        .sort({ createdAt: -1 })
        .limit(100),
      AllowanceRequest.find(scope ? { ...pendingFlow, employee: { $in: scope } } : pendingFlow)
        .populate('employee', POP_EMP)
        .populate('project', POP_PROJ)
        .populate('stages.tl.by', 'name email')
        .populate('stages.hr.by', 'name email')
        .populate('stages.finance.by', 'name email')
        .sort({ createdAt: -1 })
        .limit(100),
    ]);
    return res.status(200).json({
      leave,
      travel,
      allowance,
      me: { role, stage: stageForRole(role), canDecide: !!stageForRole(role) },
    });
  } catch (err) {
    return next(err);
  }
}

async function financeEmployeeIds() {
  const rows = await Employee.find({ department: 'Finance' }).select('_id').lean();
  return rows.map((r) => r._id);
}

/**
 * Shared stage engine for leave / travel / allowance decisions.
 *
 * Enforces the chain: Team Lead → HR → Finance. The caller may only record
 * the verdict for the stage that is currently due, so a Team Lead can never
 * approve on HR's behalf and nobody can skip a stage. `isFinanceFinal`
 * narrows the last step to one department where the spec requires it.
 */
async function decideStage({ req, res, next, Model, schema, kind, isFinanceFinal }) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  const stage = stageForRole(req.user?.role);
  if (!stage) {
    // Directors and every other role view this area read-only.
    return res.status(403).json({ message: 'You do not approve leave or travel requests.' });
  }
  try {
    const doc = await Model.findById(req.params.id).populate('employee', 'department');
    if (!doc) return res.status(404).json({ message: 'Not found.' });

    const due = nextStage(doc.stages, doc.flowStages);
    if (!due) {
      return res.status(409).json({
        message: `This request is already ${String(doc.status).toLowerCase()}.`,
      });
    }
    if (due !== stage) {
      return res.status(409).json({
        message: `Awaiting ${STAGE_LABELS[due]} approval.`,
      });
    }

    // Team Leads act only for the people under them.
    if (stage === 'tl') {
      const scope = await teamMemberIds(req.user.id);
      if (!scope.includes(String(doc.employee))) {
        return res.status(403).json({
          message: 'This request is not from anyone in your team.',
        });
      }
    }

    if (stage === 'finance' && isFinanceFinal) {
      const ok = await isFinanceFinal(doc);
      if (!ok) {
        return res.status(403).json({
          message: 'Finance can only clear its own department requests.',
        });
      }
    }

    doc.stages = doc.stages ?? {};
    doc.stages[stage] = {
      status: parsed.data.status,
      by: req.user.id,
      at: new Date(),
      remarks: parsed.data.remarks,
    };
    // Legacy mirror fields keep older consumers (HR dashboards, pills) working.
    doc.decidedBy = req.user.id;
    doc.decidedAt = new Date();
    doc.remarks = parsed.data.remarks;
    // save() (not findByIdAndUpdate) so the model hook re-derives `status`.
    await doc.save();
    await doc.populate('employee', POP_EMP);

    try {
      const recipients = (await requesterUserIds(doc)).filter((u) => u !== String(req.user.id));
      if (recipients.length > 0) {
        const approved = parsed.data.status === FLOW_APPROVED;
        await notify({
          users: recipients,
          link: { view: kind, id: String(doc._id) },
          title: approved ? `${STAGE_LABELS[stage]} approved your ${kind}` : `${kind} rejected`,
          detail: (parsed.data.remarks ?? `Status: ${doc.status}`).slice(0, 140),
          type: kind,
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

export function decideLeave(req, res, next) {
  return decideStage({
    req,
    res,
    next,
    Model: LeaveRequest,
    schema: leaveDecisionSchema,
    kind: 'leave',
    // §4.14 — Finance clears leave only for the Finance department.
    isFinanceFinal: async (doc) => doc.employee?.department === 'Finance',
  });
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
    const doc = new TravelRequest({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    await attachFlowStages(doc, employee);
    await doc.save();
    notify({
      roles: ['hr', 'admin_billing'],
      link: { view: 'travel', id: String(doc._id) },
      title: `Travel request: ${empShort(employee) || 'team member'}`,
      detail: `${parsed.data.fromCity ?? ''} → ${parsed.data.toCity ?? ''} · ${parsed.data.purpose ?? ''}`.slice(0, 140),
      type: 'travel',
    }).catch(() => {});
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

export function decideTravel(req, res, next) {
  // Finance clears travel for every department, so no narrowing here.
  return decideStage({
    req,
    res,
    next,
    Model: TravelRequest,
    schema: travelDecisionSchema,
    kind: 'travel',
  });
}

export async function settleTravel(req, res, next) {
  const parsed = travelSettleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const existing = await TravelRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found.' });
    // findByIdAndUpdate skips validate hooks: recompute totals explicitly
    // (same formula as the model hook — client-arranged lines excluded).
    const merged = { ...existing.toObject(), ...parsed.data };
    const ticked = new Set(merged.hospitalityLines ?? []);
    const line = (k) => (k === 'lodging' ? (merged.lodgingAmount ?? 0) : (merged[k] ?? 0));
    let actual = 0;
    let hospitality = 0;
    for (const k of ['fare', 'lodging', 'foodPerDiem', 'localConveyance', 'misc']) {
      if (ticked.has(k)) hospitality += line(k);
      else actual += line(k);
    }
    const doc = await TravelRequest.findByIdAndUpdate(
      req.params.id,
      {
        ...parsed.data,
        hospitality: ticked.size > 0,
        actualExpense: actual > 0 || hospitality > 0 ? actual : (merged.actualExpense ?? 0),
        hospitalityAmount: actual > 0 || hospitality > 0 ? hospitality : (merged.hospitalityAmount ?? 0),
        balance: (merged.advanceReceived ?? 0) - (actual > 0 || hospitality > 0 ? actual : 0),
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
    const doc = new AllowanceRequest({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    await attachFlowStages(doc, employee);
    await doc.save();
    notify({
      roles: ['hr', 'admin_billing'],
      link: { view: 'allowance', id: String(doc._id) },
      title: `Allowance request: ${empShort(employee) || 'team member'}`,
      detail: `${parsed.data.reqType ?? ''} · ${parsed.data.purpose ?? ''}`.slice(0, 140),
      type: 'allowance',
    }).catch(() => {});
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

export function decideAllowance(req, res, next) {
  return decideStage({
    req,
    res,
    next,
    Model: AllowanceRequest,
    schema: allowanceDecisionSchema,
    kind: 'allowance',
    isFinanceFinal: async (doc) => doc.employee?.department === 'Finance',
  });
}

// ---------------------------------------------------------------------------
// Self-service edit: a requester may correct their own request, but only
// while it still sits at the very start of the chain. Once any stage has
// recorded a verdict the request is locked.
// ---------------------------------------------------------------------------

const EDITABLE_FIELDS = {
  leave: ['leaveType', 'from', 'to', 'reason', 'reportingManager'],
  travel: [
    'project',
    'purpose',
    'fromCity',
    'toCity',
    'departureDate',
    'returnDate',
    'mode',
    'estExpense',
    'advanceRequested',
  ],
  allowance: ['reqType', 'date', 'project', 'amount', 'days', 'purpose', 'description', 'route', 'pickup', 'drop'],
};

async function editOwn({ req, res, next, Model, schema, kind }) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const me = await User.findById(req.user.id);
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (!me?.employee || String(doc.employee) !== String(me.employee)) {
      return res.status(403).json({ message: 'You can only edit your own request.' });
    }
    // Editable only before any stage has recorded a verdict — the derived
    // status alone can't tell, since a director's request skips the TL step
    // and starts life as "Pending HR".
    const acted =
      doc.stages?.tl?.status || doc.stages?.hr?.status || doc.stages?.finance?.status;
    if (acted || !isPendingFlow(doc.status)) {
      return res.status(409).json({
        message: 'This request has already moved into approval and can no longer be edited.',
      });
    }
    // employee / createdBy are never editable, and a submitted status can't
    // be set by the client.
    void req;
    const allowed = EDITABLE_FIELDS[kind] ?? [];
    for (const field of allowed) {
      if (parsed.data[field] !== undefined) doc[field] = parsed.data[field];
    }
    await doc.save(); // model hooks re-derive days / totals / status
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export function editLeave(req, res, next) {
  return editOwn({ req, res, next, Model: LeaveRequest, schema: leaveSchema, kind: 'leave' });
}

export function editTravel(req, res, next) {
  return editOwn({ req, res, next, Model: TravelRequest, schema: travelSchema, kind: 'travel' });
}

export function editAllowance(req, res, next) {
  return editOwn({
    req,
    res,
    next,
    Model: AllowanceRequest,
    schema: allowanceSchema,
    kind: 'allowance',
  });
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

export async function deleteHoliday(req, res, next) {
  try {
    const doc = await Holiday.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Holiday not found.' });
    return res.status(200).json({ removed: doc._id });
  } catch (err) {
    return next(err);
  }
}
