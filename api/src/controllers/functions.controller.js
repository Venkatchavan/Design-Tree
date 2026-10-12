import { AreaSettlement } from '../models/AreaSettlement.js';
import { BimWorkOrder } from '../models/BimWorkOrder.js';
import { BoqItem } from '../models/BoqItem.js';
import { Conveyance } from '../models/Conveyance.js';
import { Discrepancy } from '../models/Discrepancy.js';
import { GbsCert } from '../models/GbsCert.js';
import { PeerReview } from '../models/PeerReview.js';
import { Rfi } from '../models/Rfi.js';
import { SiteVisit } from '../models/SiteVisit.js';
import { WeeklyReport } from '../models/WeeklyReport.js';
import { makeCrud } from '../utils/crud.js';
import {
  areaSettlementReviewSchema,
  areaSettlementSchema,
  bimWorkOrderSchema,
  bimWorkOrderUpdateSchema,
  boqItemSchema,
  boqItemUpdateSchema,
  boqReviewSchema,
  conveyanceSchema,
  discrepancySchema,
  discrepancyUpdateSchema,
  gbsStepsSchema,
  peerChecklistSchema,
  peerCommentSchema,
  peerFinalSchema,
  peerReviewSchema,
  peerReviewUpdateSchema,
  rfiSchema,
  rfiUpdateSchema,
  siteVisitSchema,
  weeklyReportApproveSchema,
  weeklyReportSchema,
} from '../validation/phase2.schema.js';

const POP_PROJ = 'name code branch';
const POP_EMP = 'firstName lastName empId designation';

const byProject = (req) => {
  const f = {};
  if (req.query.project) f.project = req.query.project;
  return f;
};

export const areaSettlements = makeCrud(AreaSettlement, {
  scopedByProject: true,
  create: areaSettlementSchema,
  update: areaSettlementSchema.partial(),
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function reviewAreaSettlement(req, res, next) {
  const parsed = areaSettlementReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await AreaSettlement.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        reviewRemark: parsed.data.remark,
        reviewedBy: req.user.id,
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// QS/BOQ line items (QS logs, QS Head reviews) — feeds GFC readiness.
export const boqItems = makeCrud(BoqItem, {
  scopedByProject: true,
  create: boqItemSchema,
  update: boqItemUpdateSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
  decorate: async (data, req) => ({ ...data, createdBy: req.user.id }),
});

export async function reviewBoqItem(req, res, next) {
  const parsed = boqReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await BoqItem.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        remarks: parsed.data.remarks ?? undefined,
      },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const siteVisits = makeCrud(SiteVisit, {
  scopedByProject: true,
  create: siteVisitSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
  decorate: async (data) => {
    const { Counter } = await import('../models/Counter.js');
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { name: `site-visit-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return { ...data, visitId: `SV-${year}-${String(counter.seq).padStart(3, '0')}` };
  },
});

export const discrepancies = makeCrud(Discrepancy, {
  scopedByProject: true,
  create: discrepancySchema,
  update: discrepancyUpdateSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
  decorate: async (data, req) => {
    // Updates must never re-number: keep the existing id.
    if (req?.params?.id) {
      const existing = await Discrepancy.findById(req.params.id).select('discId');
      if (existing?.discId) return data;
    }
    const { Counter } = await import('../models/Counter.js');
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { name: `discrepancy-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return { ...data, discId: `DA-${year}-${String(counter.seq).padStart(2, '0')}` };
  },
});

export const conveyances = makeCrud(Conveyance, {
  create: conveyanceSchema,
  filters: (req) => {
    const f = byProject(req);
    if (req.query.employee) f.employee = req.query.employee;
    return f;
  },
  populate: [
    { path: 'project', select: POP_PROJ },
    { path: 'employee', select: POP_EMP },
  ],
});

export const rfis = makeCrud(Rfi, {
  scopedByProject: true,
  create: rfiSchema,
  update: rfiUpdateSchema,
  filters: (req) => {
    const f = byProject(req);
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  // raisedBy role powers the Management "Awaiting responses" source labels
  // (Client / Architect vs internal) without an extra users request.
  populate: [{ path: 'project', select: POP_PROJ }, { path: 'raisedBy', select: 'name email role' }],
  decorate: async (data, req) => {
    // Updates must never re-number: keep the existing id.
    if (req?.params?.id) {
      const existing = await Rfi.findById(req.params.id).select('rfiNo');
      if (existing?.rfiNo) return data;
    }
    const { Counter } = await import('../models/Counter.js');
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { name: `rfi-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return { ...data, rfiNo: `RFI-${year}-${String(counter.seq).padStart(3, '0')}` };
  },
});

export async function createRfi(req, res, next) {
  const parsed = rfiSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const { Counter } = await import('../models/Counter.js');
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { name: `rfi-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const doc = await Rfi.create({
      ...parsed.data,
      rfiNo: `RFI-${year}-${String(counter.seq).padStart(3, '0')}`,
      raisedBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const bimWorkOrders = makeCrud(BimWorkOrder, {
  scopedByProject: true,
  create: bimWorkOrderSchema,
  update: bimWorkOrderUpdateSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
});

// QA/QC weekly reports: submitted by the QA/QC team, approved by the
// QA/QC Specs Head. Reads are internal-wide (management + AssocTD views).
export const weeklyReports = makeCrud(WeeklyReport, {
  scopedByProject: true,
  create: weeklyReportSchema,
  filters: byProject,
  populate: [
    { path: 'project', select: POP_PROJ },
    { path: 'approvedBy', select: 'name email' },
  ],
});

export async function approveWeeklyReport(req, res, next) {
  const parsed = weeklyReportApproveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await WeeklyReport.findByIdAndUpdate(
      req.params.id,
      {
        status: parsed.data.status,
        approvedAt: parsed.data.status === 'Approved' ? new Date() : undefined,
        approvedBy: parsed.data.status === 'Approved' ? req.user.id : undefined,
      },
      { new: true, returnDocument: 'after', runValidators: true },
    ).populate([
      { path: 'project', select: POP_PROJ },
      { path: 'approvedBy', select: 'name email' },
    ]);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function getGbsCert(req, res, next) {
  try {
    const doc = await GbsCert.findOne({
      project: req.query.project ?? req.params.projectId,
    }).populate('project', POP_PROJ);
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function saveGbsSteps(req, res, next) {
  const parsed = gbsStepsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await GbsCert.findOneAndUpdate(
      { project: parsed.data.project },
      {
        project: parsed.data.project,
        steps: parsed.data.steps,
        updatedBy: req.user.id,
      },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const peerReviews = makeCrud(PeerReview, {
  scopedByProject: true,
  create: peerReviewSchema,
  update: peerReviewUpdateSchema,
  filters: (req) => {
    const f = byProject(req);
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
  decorate: async (data, req) => {
    // Updates must never re-number: keep the existing id.
    if (req?.params?.id) {
      const existing = await PeerReview.findById(req.params.id).select('jobNo');
      if (existing?.jobNo) return data;
    }
    const { Counter } = await import('../models/Counter.js');
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { name: `peer-review-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return { ...data, jobNo: `PR-${year}-${String(counter.seq).padStart(3, '0')}` };
  },
});

async function pushSub(docId, field, value, res, next) {
  try {
    const doc = await PeerReview.findByIdAndUpdate(
      docId,
      { $push: { [field]: value } },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function addChecklistItem(req, res, next) {
  const parsed = peerChecklistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  return pushSub(req.params.id, 'checklist', parsed.data, res, next);
}

export async function updateChecklistItem(req, res, next) {
  try {
    const doc = await PeerReview.findOneAndUpdate(
      { _id: req.params.id, 'checklist._id': req.params.itemId },
      { $set: Object.fromEntries(
        Object.entries(req.body).map(([k, v]) => [`checklist.$.${k}`, v]),
      ) },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function addComment(req, res, next) {
  const parsed = peerCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  return pushSub(req.params.id, 'comments', parsed.data, res, next);
}

export async function updateComment(req, res, next) {
  try {
    const doc = await PeerReview.findOneAndUpdate(
      { _id: req.params.id, 'comments._id': req.params.itemId },
      { $set: Object.fromEntries(
        Object.entries(req.body).map(([k, v]) => [`comments.$.${k}`, v]),
      ) },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setPeerFinal(req, res, next) {
  const parsed = peerFinalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await PeerReview.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
