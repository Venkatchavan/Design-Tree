import { ServiceDashboard } from '../models/ServiceDashboard.js';
import { serviceDashboardSchema } from '../validation/serviceDashboard.schema.js';

export async function listServiceDashboards(req, res, next) {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.service) filter.service = req.query.service;
    const items = await ServiceDashboard.find(filter);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

// One record per project and service; saving creates it or updates it.
export async function saveServiceDashboard(req, res, next) {
  const parsed = serviceDashboardSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  const { project, service, ...fields } = parsed.data;
  try {
    const doc = await ServiceDashboard.findOneAndUpdate(
      { project, service },
      { $set: { project, service, ...fields } },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
