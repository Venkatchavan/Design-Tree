import {
  CollateralRequest,
  Contact,
  MarketingBrief,
} from '../models/Marketing.js';
import { Project } from '../models/Project.js';
import { makeCrud } from '../utils/crud.js';
import {
  briefSchema,
  collateralSchema,
  contactSchema,
} from '../validation/phase4.schema.js';

export async function portfolio(_req, res, next) {
  try {
    const [projects, briefs] = await Promise.all([
      Project.find(
        {},
        { name: 1, code: 1, clientName: 1, branch: 1, status: 1, completion: 1, currentStage: 1, location: 1, contacts: 1, description: 1 },
      ).sort({ name: 1 }),
      MarketingBrief.find({}),
    ]);
    const byProject = new Map(briefs.map((b) => [b.project.toString(), b]));
    const items = projects.map((p) => {
      const b = byProject.get(p._id.toString());
      return {
        id: p._id.toString(),
        name: p.name,
        code: p.code,
        client: p.clientName,
        location: p.location?.city ?? p.branch ?? '',
        architect: p.contacts?.architect?.company ?? p.contacts?.architect?.name ?? '',
        description: p.description ?? '',
        stage: p.currentStage,
        completion: p.completion,
        status: p.status,
        marketingReady: b?.marketingReady ?? false,
        category: b?.category ?? '',
      };
    });
    const completed = items.filter((i) => i.status === 'Completed').length;
    return res.status(200).json({
      items,
      total: items.length,
      summary: {
        portfolio: items.length,
        completed,
        ongoing: items.length - completed,
        ready: items.filter((i) => i.marketingReady).length,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getBrief(req, res, next) {
  try {
    const doc = await MarketingBrief.findOne({
      project: req.query.project ?? req.params.projectId,
    }).populate('project', 'name code clientName currentStage completion status location branch contacts description');
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function saveBrief(req, res, next) {
  const parsed = briefSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await MarketingBrief.findOneAndUpdate(
      { project: parsed.data.project },
      { ...parsed.data, updatedBy: req.user.id },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const collateral = makeCrud(CollateralRequest, {
  create: collateralSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: 'name code' }],
});

export async function createCollateral(req, res, next) {
  const parsed = collateralSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await CollateralRequest.create({
      ...parsed.data,
      requestedBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export const contacts = makeCrud(Contact, {
  create: contactSchema,
  filters: (req) => {
    const f = {};
    if (req.query.type) f.type = req.query.type;
    if (req.query.search) {
      const rx = new RegExp(
        req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      f.$or = [{ name: rx }, { organization: rx }, { email: rx }, { phone: rx }];
    }
    return f;
  },
  populate: [
    { path: 'project', select: 'name code' },
    { path: 'addedBy', select: 'name email' },
  ],
});

export async function createContact(req, res, next) {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Contact.create({
      ...parsed.data,
      addedBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function contactSummary(_req, res, next) {
  try {
    const rows = await Contact.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const summary = { total: 0 };
    for (const r of rows) {
      summary.total += r.count;
      summary[r._id ?? 'Other'] = r.count;
    }
    return res.status(200).json(summary);
  } catch (err) {
    return next(err);
  }
}
