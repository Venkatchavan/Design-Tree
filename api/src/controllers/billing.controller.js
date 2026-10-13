import { Claim } from '../models/Claim.js';
import { Payment } from '../models/Payment.js';
import { Project } from '../models/Project.js';
import { Recruitment } from '../models/Recruitment.js';
import { StageStatus } from '../models/StageStatus.js';
import { WorkEntry } from '../models/WorkEntry.js';
import { Employee } from '../models/Employee.js';
import { makeCrud } from '../utils/crud.js';
import {
  claimSchema,
  claimStatusSchema,
  claimUpdateSchema,
  paymentSchema,
  quoteSchema,
  stageStatusSchema,
  stageStatusUpdateSchema,
} from '../validation/phase3.schema.js';

const POP_PROJ = 'name code branch clientName';

export const claims = makeCrud(Claim, {
  create: claimSchema,
  update: claimUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function createClaim(req, res, next) {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const project = await Project.findById(parsed.data.project);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (!await billingApproved(parsed.data.project, parsed.data.stage, parsed.data.service)) return res.status(409).json({ message: 'TD approval is required before billing.' });
    if (parsed.data.status === 'Billed') return res.status(400).json({ message: 'Create the claim first, then mark it billed.' });
    const doc = await Claim.create({ ...parsed.data, createdBy: req.user.id });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setClaimStatus(req, res, next) {
  const parsed = claimStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const old = await Claim.findById(req.params.id);
    if (!old) return res.status(404).json({ message: 'Claim not found.' });
    if (parsed.data.status === 'Billed' && !await billingApproved(old.project, old.stage, old.service)) return res.status(409).json({ message: 'TD approval is required before billing.' });
    const patch = { status: parsed.data.status };
    if (parsed.data.status === 'Billed') patch.billedAt = new Date();
    const doc = await Claim.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    }).populate('project', POP_PROJ);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    // A billed claim flips the matching stage tracker to Billed.
    if (parsed.data.status === 'Billed' && doc.stage) {
      await StageStatus.updateMany(
        { project: doc.project._id ?? doc.project, stage: doc.stage, confirmationStatus: 'TD Approved', ...(doc.service ? { service: doc.service } : {}) },
        { billingReadiness: 'Billed', updatedBy: req.user.id },
      );
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const stages = makeCrud(StageStatus, {
  scopedByProject: true,
  create: stageStatusSchema,
  update: stageStatusUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.readiness) f.billingReadiness = req.query.readiness;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function upsertStage(req, res, next) {
  const parsed = stageStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid stage data.' });
  try {
    const { requestCompletion, confirmCompletion, approveCompletion, ptlRemark, spocRemark, tdRemark, ...rest } = parsed.data;
    const { canReadProject } = await import('../utils/projectScope.js');
    if (!await canReadProject(req.user, rest.project)) return res.status(403).json({ message: 'Project is not assigned to you.' });
    if (!await Project.exists({ _id: rest.project })) return res.status(404).json({ message: 'Project not found.' });
    const identity = { project: rest.project, service: rest.service ?? null, stage: rest.stage ?? null };
    const old = await StageStatus.findOne(identity);
    const count = [requestCompletion, confirmCompletion, approveCompletion].filter(Boolean).length;
    if (count > 1) return res.status(400).json({ message: 'Choose one approval action.' });
    let patch = { ...rest, updatedBy: req.user.id };
    let from = old?.confirmationStatus ?? 'None';
    let action = 'Stage updated';
    if (old?.billingReadiness === 'Billed') return res.status(409).json({ message: 'An already billed stage cannot be changed.' });
    if (requestCompletion) {
      if (req.user.role !== 'team_lead') return res.status(403).json({ message: 'Only the assigned PTL can request completion.' });
      if (!['None', 'PTL Requested'].includes(from)) return res.status(409).json({ message: 'Completion has already progressed to approval.' });
      patch = { ...patch, confirmationStatus: 'PTL Requested', ptlRequestedBy: req.user.id, ptlRequestedAt: new Date(), ptlRemark, currentStatus: 'Pending SPOC approval', billingReadiness: 'Pending' };
      action = 'PTL requested completion';
    } else if (confirmCompletion) {
      if (req.user.role !== 'coordinator') return res.status(403).json({ message: 'Only the assigned SPOC can confirm completion.' });
      if (from !== 'PTL Requested') return res.status(409).json({ message: 'A PTL request is required first.' });
      patch = { ...patch, confirmationStatus: 'SPOC Confirmed', spocConfirmedBy: req.user.id, spocConfirmedAt: new Date(), spocRemark, currentStatus: 'Pending TD approval', billingReadiness: 'Pending' };
      action = 'SPOC confirmed completion';
    } else if (approveCompletion) {
      if (req.user.role !== 'technical_director') return res.status(403).json({ message: 'Only the Technical Director approves completion.' });
      if (from !== 'SPOC Confirmed') return res.status(409).json({ message: 'SPOC approval is required first.' });
      patch = { ...patch, confirmationStatus: 'TD Approved', tdApprovedBy: req.user.id, tdApprovedAt: new Date(), tdRemark, currentStatus: 'Completed', billingReadiness: 'Ready for billing' };
      action = 'TD approved completion';
    } else {
      if (rest.billingReadiness === 'Billed' || ((rest.billingReadiness === 'Ready for billing' || rest.currentStatus === 'Completed') && from !== 'TD Approved')) {
        return res.status(409).json({ message: 'PTL, SPOC and TD approvals are required before billing.' });
      }
      if (from !== 'None') return res.status(409).json({ message: 'Use the next approval action for this stage.' });
    }
    const doc = old
      ? await StageStatus.findOneAndUpdate({ _id: old._id, confirmationStatus: from, billingReadiness: { $ne: 'Billed' } }, { $set: patch, $push: { history: { by: req.user.id, action } } }, { returnDocument: 'after', runValidators: true })
      : await StageStatus.create({ ...patch, history: [{ by: req.user.id, action }] });
    if (!doc) return res.status(409).json({ message: 'Stage changed; refresh before approving.' });
    try {
      const { notify, userIdsForEmployees } = await import('../models/Notification.js');
      const { SpocAllocation } = await import('../models/SpocAllocation.js');
      const allocations = await SpocAllocation.find({ project: rest.project, status: 'Approved' });
      const users = await userIdsForEmployees(allocations.map(a => a.coordinator));
      if (doc.ptlRequestedBy && String(doc.ptlRequestedBy)!==String(req.user.id)) users.push(String(doc.ptlRequestedBy));
      await notify({ users, roles: approveCompletion ? ['design_mgmt_head', 'founding_director', 'working_director', 'executive_director', 'associate_director', 'technical_director', 'assoc_technical_director', 'admin_billing'] : confirmCompletion ? ['technical_director'] : ['design_mgmt_head'], project: rest.project, link: { view: 'project-detail', id: String(rest.project) }, title: action, detail: `${rest.service ?? ''} ${rest.stage ?? ''} — ${doc.currentStatus}`, type: 'stage-approval' });
    } catch { /* persisted approval remains available when live notifications fail */ }
    return res.status(200).json({ item: doc });
  } catch (err) { return next(err); }
}

export async function updateStage(req, res, next) {
  try {
    const doc = await StageStatus.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Stage not found.' });
    if (req.body?.project && String(req.body.project) !== String(doc.project)) return res.status(400).json({ message: 'Stage cannot move projects.' });
    req.body = { ...req.body, project: String(doc.project), service: doc.service, stage: doc.stage };
    return upsertStage(req, res, next);
  } catch (err) { return next(err); }
}

async function billingApproved(project, stage, service) {
  if (!stage) return false;
  const rows = await StageStatus.find({ project, stage, ...(service ? { service } : {}) }).lean();
  return rows.length > 0 && rows.every(s => s.confirmationStatus === 'TD Approved');
}

export async function updateClaim(req, res, next) {
  try {
    const old = await Claim.findById(req.params.id);
    if (!old) return res.status(404).json({ message: 'Claim not found.' });
    if (req.body.status === 'Billed' && old.status !== 'Billed') return res.status(400).json({message:'Use the claim status action to mark billing.'});
    const data = { ...old.toObject(), ...req.body };
    if (!await billingApproved(data.project, data.stage, data.service)) return res.status(409).json({ message: 'TD approval is required before billing.' });
    return claims.update(req, res, next);
  } catch (err) { return next(err); }
}

export async function quotedFees(req, res, next) {
  try {
    const projects = await Project.find(
      {},
      { name: 1, code: 1, scope: 1, quotedFee: 1, quotedHospitality: 1 },
    ).sort({ name: 1 });
    return res.status(200).json({
      items: projects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        code: p.code,
        scope: (p.scope ?? []).map((s) => ({
          service: s.service,
          scope: s.scope,
          fee: s.fee,
        })),
        scopedTotal: (p.scope ?? []).reduce((s, x) => s + (x.fee ?? 0), 0),
        quotedFee: p.quotedFee,
        hospitality: p.quotedHospitality,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function setQuote(req, res, next) {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Project.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project: doc });
  } catch (err) {
    return next(err);
  }
}

export const payments = makeCrud(Payment, {
  create: paymentSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function createPayment(req, res, next) {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Payment.create({
      ...parsed.data,
      recordedBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// Live commercial snapshot for Billing + Finance (§4.4, §4.14).
export async function commercialOverview(_req, res, next) {
  try {
    const [projects, claims, payments] = await Promise.all([
      Project.find({}, { scope: 1, quotedFee: 1 }),
      Claim.find({}, { project: 1, stage: 1, amount: 1, status: 1 }),
      Payment.find({}, { project: 1, amount: 1 }),
    ]);
    const contractValue = projects.reduce(
      (s, p) =>
        s + (p.quotedFee ?? (p.scope ?? []).reduce((a, x) => a + (x.fee ?? 0), 0)),
      0,
    );
    const invoiced = claims
      .filter((c) => c.status === 'Billed' || c.status === 'Ready for billing')
      .reduce((s, c) => s + c.amount, 0);
    const received = payments.reduce((s, p) => s + p.amount, 0);
    const ready = claims.filter((c) => c.status === 'Ready for billing').length;
    const pending = claims.filter((c) => c.status === 'Pending').length;
    return res.status(200).json({
      contractValue,
      invoiced,
      received,
      pctCollected: invoiced > 0 ? Math.round((received / invoiced) * 100) : 0,
      ready,
      pending,
    });
  } catch (err) {
    return next(err);
  }
}

// Finance dashboard aggregates (§4.14 headlines).
export async function financeOverview(_req, res, next) {
  try {
    const commercialReq = { query: {} };
    const commercialRes = {
      status: () => commercialRes,
      json: (o) => o,
    };
    const commercial = await new Promise((resolve, reject) => {
      commercialRes.json = resolve;
      commercialOverview(commercialReq, commercialRes, reject);
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [entriesToday, pendingRecruit, atRisk] = await Promise.all([
      WorkEntry.aggregate([
        { $match: { date: { $gte: today } } },
        { $group: { _id: null, hours: { $sum: '$hours' } } },
      ]),
      Recruitment.countDocuments({
        status: { $in: ['Submitted', 'Under Review'] },
      }),
      StageStatus.countDocuments({ delayDays: { $gt: 0 } }),
    ]);
    return res.status(200).json({
      ...commercial,
      hoursToday: entriesToday[0]?.hours ?? 0,
      pendingApprovals: pendingRecruit,
      atRisk,
    });
  } catch (err) {
    return next(err);
  }
}

// Revenue by project for Revenue & Financial Reports (§4.15).
export async function revenueByProject(_req, res, next) {
  try {
    const [projects, claims, payments] = await Promise.all([
      Project.find({}, { name: 1, code: 1, scope: 1, quotedFee: 1 }),
      Claim.find({}),
      Payment.find({}),
    ]);
    const rows = projects.map((p) => {
      const pid = p._id.toString();
      const contract =
        p.quotedFee ?? (p.scope ?? []).reduce((s, x) => s + (x.fee ?? 0), 0);
      const invoiced = claims
        .filter(
          (c) =>
            c.project.toString() === pid &&
            (c.status === 'Billed' || c.status === 'Ready for billing'),
        )
        .reduce((s, c) => s + c.amount, 0);
      const received = payments
        .filter((c) => c.project.toString() === pid)
        .reduce((s, c) => s + c.amount, 0);
      const serviceRows = (p.scope ?? []).filter((x) => x.service).map((x) => {
        const svcInvoiced = claims
          .filter((c) => c.project.toString() === pid && c.service === x.service && (c.status === 'Billed' || c.status === 'Ready for billing'))
          .reduce((s, c) => s + c.amount, 0);
        const svcReceived = payments
          .filter((c) => c.project.toString() === pid && c.service === x.service)
          .reduce((s, c) => s + c.amount, 0);
        return {
          service: x.service,
          contract: x.fee ?? 0,
          invoiced: svcInvoiced,
          received: svcReceived,
          outstanding: (x.fee ?? 0) - svcInvoiced,
        };
      });
      return {
        id: pid,
        name: p.name,
        code: p.code,
        contract,
        invoiced,
        received,
        pct: invoiced > 0 ? Math.round((received / invoiced) * 100) : 0,
        outstanding: invoiced - received,
        services: [...new Set((p.scope ?? []).map((x) => x.service).filter(Boolean))],
        serviceRows,
      };
    });
    // Per-service splits for the Management Finance tab. Contract comes from
    // scope fees (always present); invoiced/received only from service-tagged
    // claims/payments — untagged legacy entries stay in project totals above.
    const byService = (() => {
      const m = new Map();
      for (const p of projects) {
        for (const s of p.scope ?? []) {
          if (!s.service) continue;
          const g = m.get(s.service) ?? { service: s.service, projects: new Set(), contract: 0, invoiced: 0, received: 0 };
          g.projects.add(p._id.toString());
          g.contract += s.fee ?? 0;
          m.set(s.service, g);
        }
      }
      for (const c of claims) {
        if (!c.service) continue;
        const g = m.get(c.service) ?? { service: c.service, projects: new Set(), contract: 0, invoiced: 0, received: 0 };
        if ((c.status === 'Billed' || c.status === 'Ready for billing')) g.invoiced += c.amount;
        m.set(c.service, g);
      }
      for (const pay of payments) {
        if (!pay.service) continue;
        const g = m.get(pay.service) ?? { service: pay.service, projects: new Set(), contract: 0, invoiced: 0, received: 0 };
        g.received += pay.amount;
        m.set(pay.service, g);
      }
      return [...m.values()].map((g) => ({
        service: g.service,
        projects: g.projects.size,
        contract: g.contract,
        invoiced: g.invoiced,
        received: g.received,
        pct: g.invoiced > 0 ? Math.round((g.received / g.invoiced) * 100) : 0,
      })).sort((a, b) => b.contract - a.contract);
    })();
    return res.status(200).json({ items: rows, total: rows.length, byService });
  } catch (err) {
    return next(err);
  }
}

// Project labour cost from logged hours × employee rates (§4.15 snapshot).
export async function projectCosts(_req, res, next) {
  try {
    const [entries, employees, projects] = await Promise.all([
      WorkEntry.find({}, { employee: 1, project: 1, hours: 1 }),
      Employee.find({}, { hourlyRate: 1 }),
      Project.find({}, { name: 1, code: 1, quotedFee: 1, scope: 1 }),
    ]);
    const rates = new Map(employees.map((e) => [e._id.toString(), e.hourlyRate ?? 0]));
    const byProject = new Map();
    for (const e of entries) {
      const pid = e.project?.toString();
      if (!pid) continue;
      const agg = byProject.get(pid) ?? { hours: 0, cost: 0 };
      agg.hours += e.hours ?? 0;
      agg.cost += (e.hours ?? 0) * (rates.get(e.employee?.toString()) ?? 0);
      byProject.set(pid, agg);
    }
    return res.status(200).json({
      items: projects.map((p) => {
        const pid = p._id.toString();
        const agg = byProject.get(pid) ?? { hours: 0, cost: 0 };
        const budget =
          p.quotedFee ?? (p.scope ?? []).reduce((s, x) => s + (x.fee ?? 0), 0);
        return {
          id: pid,
          name: p.name,
          code: p.code,
          manHours: Math.round(agg.hours * 10) / 10,
          labourCost: Math.round(agg.cost),
          budget,
          utilizedPct: budget > 0 ? Math.round((agg.cost / budget) * 100) : 0,
          variance: budget - Math.round(agg.cost),
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
}
