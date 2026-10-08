import { AreaSettlement } from '../models/AreaSettlement.js';
import { BimWorkOrder } from '../models/BimWorkOrder.js';
import { BoqItem } from '../models/BoqItem.js';
import { Conveyance } from '../models/Conveyance.js';
import { Discrepancy } from '../models/Discrepancy.js';
import { GbsCert } from '../models/GbsCert.js';
import { PeerReview } from '../models/PeerReview.js';
import { Rfi } from '../models/Rfi.js';
import { SiteVisit } from '../models/SiteVisit.js';
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
} from '../validation/phase2.schema.js';

const POP_PROJ = 'name code branch';
const POP_EMP = 'firstName lastName empId designation';

const byProject = (req) => {
  const f = {};
  if (req.query.project) f.project = req.query.project;
  return f;
};

export const areaSettlements = makeCrud(AreaSettlement, {
  create: areaSettlementSchema,
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
  create: siteVisitSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
});

export const discrepancies = makeCrud(Discrepancy, {
  create: discrepancySchema,
  update: discrepancyUpdateSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
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
  create: rfiSchema,
  update: rfiUpdateSchema,
  filters: (req) => {
    const f = byProject(req);
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function createRfi(req, res, next) {
  const parsed = rfiSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Rfi.create({ ...parsed.data, raisedBy: req.user.id });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const bimWorkOrders = makeCrud(BimWorkOrder, {
  create: bimWorkOrderSchema,
  update: bimWorkOrderUpdateSchema,
  filters: byProject,
  populate: [{ path: 'project', select: POP_PROJ }],
});

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
  create: peerReviewSchema,
  update: peerReviewUpdateSchema,
  filters: (req) => {
    const f = byProject(req);
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
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
