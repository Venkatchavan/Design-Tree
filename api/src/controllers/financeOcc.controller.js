import { FinanceOccEntry } from '../models/FinanceOccEntry.js';
import { User } from '../models/User.js';
import { makeCrud } from '../utils/crud.js';
import {
  financeOccSchema,
  financeOccStatusSchema,
  financeOccUpdateSchema,
} from '../validation/phase3.schema.js';

const POPULATE = [
  { path: 'employee', select: 'firstName lastName empId designation department' },
  { path: 'project', select: 'name code' },
  { path: 'linkedTravel', select: 'purpose location amount status' },
];

export const financeOcc = makeCrud(FinanceOccEntry, {
  create: financeOccSchema,
  update: financeOccUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.kind) f.kind = req.query.kind;
    if (req.query.status) f.status = req.query.status;
    if (req.query.employee) f.employee = req.query.employee;
    if (req.query.project) f.project = req.query.project;
    if (req.query.vendor) f.vendor = req.query.vendor;
    if (req.query.client) f.client = req.query.client;
    if (req.query.approval) f.approval = req.query.approval;
    if (req.query.payment) f.payment = req.query.payment;
    if (req.query.settlement) f.settlement = req.query.settlement;
    return f;
  },
  populate: POPULATE,
  decorate: async (data, req) => ({
    ...data,
    createdBy: req.user.id,
    history: [{ by: req.user.id, action: 'Created' }],
  }),
});

function verificationComplete(checks) {
  const entries = Object.entries(checks ?? {});
  if (entries.length === 0) return false;
  return entries.every(([, v]) => v === true);
}

export async function createFinanceOcc(req, res, next) {
  const parsed = financeOccSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await FinanceOccEntry.create({
      ...parsed.data,
      createdBy: req.user.id,
      history: [{ by: req.user.id, action: 'Created' }],
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function updateFinanceOcc(req, res, next) {
  const parsed = financeOccUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await FinanceOccEntry.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    Object.assign(doc, parsed.data);
    doc.history.push({ by: req.user.id, action: 'Updated' });
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// Finance-only decision: status / approval / payment / settlement + checklist.
// Reference locks Verified/Approved/Paid until the hardcopy checklist is complete.
export async function decideFinanceOcc(req, res, next) {
  const parsed = financeOccStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await FinanceOccEntry.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (parsed.data.verification) {
      const prev = doc.verification?.checks;
      const prevObj =
        prev instanceof Map ? Object.fromEntries(prev) : { ...(prev ?? {}) };
      const checks = {
        ...prevObj,
        ...(parsed.data.verification.checks ?? {}),
      };
      doc.verification.checks = checks;
      if (parsed.data.verification.missing !== undefined) {
        doc.verification.missing = parsed.data.verification.missing;
      }
      doc.verification.completed = verificationComplete(checks);
    }
    const gated = ['Verified', 'Approved', 'Paid'].includes(parsed.data.status);
    if (gated && !doc.verification?.completed && doc.kind !== 'po') {
      return res.status(400).json({
        message: 'Complete the bill-verification checklist first.',
      });
    }
    const from = doc.status;
    doc.status = parsed.data.status;
    if (parsed.data.approval) doc.approval = parsed.data.approval;
    if (parsed.data.payment) doc.payment = parsed.data.payment;
    if (parsed.data.settlement) doc.settlement = parsed.data.settlement;
    doc.history.push({
      by: req.user.id,
      action: `${from} → ${parsed.data.status}${parsed.data.remark ? ` — ${parsed.data.remark}` : ''}`,
    });
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function deleteFinanceOcc(req, res, next) {
  try {
    const doc = await FinanceOccEntry.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function financeOccSummary(_req, res, next) {
  try {
    const rows = await FinanceOccEntry.aggregate([
      { $group: { _id: { kind: '$kind', status: '$status' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]);
    const summary = {
      total: 0,
      amount: 0,
      advances: 0,
      claims: 0,
      pos: 0,
      pending: 0,
      verified: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
    };
    for (const r of rows) {
      summary.total += r.count;
      summary.amount += r.amount ?? 0;
      if (r._id.kind === 'advance') summary.advances += r.count;
      if (r._id.kind === 'claim') summary.claims += r.count;
      if (r._id.kind === 'po') summary.pos += r.count;
      const key = String(r._id.status ?? '').toLowerCase();
      if (key in summary) summary[key] += r.count;
    }
    return res.status(200).json(summary);
  } catch (err) {
    return next(err);
  }
}

export async function myFinanceOcc(req, res, next) {
  try {
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await FinanceOccEntry.find({ employee: me.employee })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate(POPULATE);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}
