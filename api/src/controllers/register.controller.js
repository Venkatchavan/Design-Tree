import { sendTransmittalPdf } from '../utils/transmittalPdf.js';
import { SpocAllocation } from '../models/SpocAllocation.js';
import { Team } from '../models/Team.js';
import { TransmittalRecord } from '../models/TransmittalRecord.js';
import { User } from '../models/User.js';
import { makeCrud } from '../utils/crud.js';
import {
  transmittalRecordSchema,
  transmittalRecordUpdateSchema,
} from '../validation/phase3.schema.js';

const FULL_REGISTER_ROLES = [
  'founding_director',
  'working_director',
  'executive_director',
  'admin_billing',
  'associate_director',
  'technical_director',
  'assoc_technical_director',
  'design_mgmt_head',
];

export async function scopedProjectIds(userId) {
  const me = await User.findById(userId);
  if (!me?.employee) return [];
  const [teams, allocs] = await Promise.all([
    Team.find({
      $or: [{ lead: me.employee }, { 'members.employee': me.employee }],
    }).select('projects'),
    SpocAllocation.find({ coordinator: me.employee, status: 'Approved' }).select('project'),
  ]);
  const ids = new Set();
  for (const t of teams) {
    for (const p of t.projects ?? []) ids.add(p.toString());
  }
  for (const a of allocs) {
    if (a.project) ids.add(a.project.toString());
  }
  return [...ids];
}

export async function listRecords(req, res, next) {
  try {
    const filter = {};
    if (req.query.service) filter.service = req.query.service;
    if (req.query.search) {
      const rx = new RegExp(
        req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [{ trNo: rx }, { projectName: rx }, { team: rx }];
    }
    if (!FULL_REGISTER_ROLES.includes(req.user.role)) {
      const ids = await scopedProjectIds(req.user.id);
      filter.project = { $in: ids };
    }
    if (req.query.project) {
      if (filter.project?.$in && !filter.project.$in.includes(req.query.project)) return res.status(200).json({ items: [], total: 0, summary: {} });
      filter.project = req.query.project;
    }
    if (req.query.projects) {
      const selected = String(req.query.projects).split(',').filter(id => /^[a-f0-9]{24}$/i.test(id));
      const allowed = filter.project?.$in;
      filter.project = { $in: allowed ? selected.filter(id => allowed.includes(id)) : selected };
    }
    for (const key of ['docType', 'print', 'dept']) if (req.query[key]) filter[key] = req.query[key];
    if (req.query.from || req.query.to) filter.date = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to + 'T23:59:59.999Z') } : {}) };
    if (req.query.format === 'pdf') {
      const rows = await TransmittalRecord.find(filter).populate('project', 'name code').sort({ date: -1 });
      return sendTransmittalPdf(res, rows, req.query);
    }
    const [items, total] = await Promise.all([
      TransmittalRecord.find(filter)
        .populate('project', 'name code branch')
        .sort({ date: -1 })
        .limit(500),
      TransmittalRecord.countDocuments(filter),
    ]);
    const agg = await TransmittalRecord.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          transmittals: { $sum: 1 },
          sheets: { $sum: '$total' },
          projects: { $addToSet: '$project' },
        },
      },
    ]);
    const summary = agg[0] ?? { transmittals: 0, sheets: 0, projects: [] };
    return res.status(200).json({
      items,
      total,
      summary: {
        transmittals: summary.transmittals,
        sheets: summary.sheets ?? 0,
        projects: summary.projects?.length ?? 0,
      },
    });
  } catch (err) {
    return next(err);
  }
}

const crud = makeCrud(TransmittalRecord, {
  scopedByProject: true,
  create: transmittalRecordSchema,
  update: transmittalRecordUpdateSchema,
  populate: [{ path: 'project', select: 'name code branch' }],
});

export async function createRecord(req, res, next) {
  const parsed = transmittalRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    if (req.user.role === 'team_lead') {
      const assignedProjects = await scopedProjectIds(req.user.id);
      if (!assignedProjects.includes(String(parsed.data.project))) {
        return res.status(403).json({ message: 'You can only log transmittals for your assigned team projects.' });
      }
    }
    // Create directly: re-parsing would reject the injected createdBy key.
    const doc = await TransmittalRecord.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function updateRecord(req, res, next) {
  const parsed = transmittalRecordUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  req.body = parsed.data;
  return crud.update(req, res, next);
}

export const getRecord = crud.get;
