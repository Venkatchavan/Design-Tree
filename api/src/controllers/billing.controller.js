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
      await StageStatus.findOneAndUpdate(
        { project: doc.project._id ?? doc.project, stage: doc.stage },
        { billingReadiness: 'Billed', updatedBy: req.user.id },
      );
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const stages = makeCrud(StageStatus, {
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
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await StageStatus.findOneAndUpdate(
      {
        project: parsed.data.project,
        service: parsed.data.service ?? null,
        stage: parsed.data.stage ?? null,
      },
      { ...parsed.data, updatedBy: req.user.id },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    // A completed stage that hasn't been billed yet is flagged Ready and
    // the billing team is notified automatically.
    let finalDoc = doc;
    const isCompleted = String(doc.currentStatus ?? '').trim().toLowerCase() === 'completed';
    if (isCompleted && doc.billingReadiness !== 'Billed' && doc.billingReadiness !== 'Ready for billing') {
      finalDoc = await StageStatus.findByIdAndUpdate(
        doc._id,
        { billingReadiness: 'Ready for billing' },
        { new: true, returnDocument: 'after', runValidators: true },
      );
      try {
        const { notify } = await import('../models/Notification.js');
        const proj = await Project.findById(doc.project).select('name code').lean();
        const projLabel = proj ? `${proj.name} (${proj.code})` : 'a project';
        await notify({
          roles: ['admin_billing', 'executive_director'],
          project: doc.project,
          link: { view: 'billing' },
          title: `Stage ready for billing: ${finalDoc.stage || 'stage'} — ${projLabel}`,
          detail: `${finalDoc.service || 'Service'} stage completed and flagged ready for billing.`,
          type: 'stage-ready',
        });
      } catch {
        /* readiness flip itself succeeded — notification is best-effort */
      }
    }
    // A service running past its planned date notifies its team automatically.
    if (Number(finalDoc.delayDays ?? 0) > 0) {
      try {
        const { notify } = await import('../models/Notification.js');
        const proj = await Project.findById(finalDoc.project).select('name code').lean();
        const projLabel = proj ? `${proj.name} (${proj.code})` : 'a project';
        await notify({
          roles: ['admin_billing', 'design_mgmt_head'],
          project: finalDoc.project,
          link: { view: 'billing' },
          title: `Stage delay: ${finalDoc.stage || 'stage'} — ${projLabel}`,
          detail: `${finalDoc.service || 'Service'} is ${finalDoc.delayDays} day(s) past planned completion.${finalDoc.reason ? ` Reason: ${finalDoc.reason}` : ''}`,
          type: 'stage-delay',
        });
      } catch {
        /* stage save itself succeeded — notification is best-effort */
      }
    }
    return res.status(200).json({ item: finalDoc });
  } catch (err) {
    return next(err);
  }
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
      };
    });
    return res.status(200).json({ items: rows, total: rows.length });
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
