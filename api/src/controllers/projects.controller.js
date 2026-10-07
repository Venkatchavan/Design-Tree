import {
  PROJECT_STATUSES,
  Project,
  SERVICES,
  STAGES,
} from '../models/Project.js';
import {
  projectSchema,
  projectUpdateSchema,
} from '../validation/project.schema.js';

const CREATOR_ROLES = [
  'admin_billing',
  'executive_director',
  'associate_director',
  'technical_director',
];

export { CREATOR_ROLES };

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listProjects(req, res, next) {
  try {
    const { branch, service, stage, status, search } = req.query;
    const filter = {};
    if (branch) filter.branch = branch;
    if (stage) filter.currentStage = stage;
    if (status) filter.status = status;
    if (service) filter['scope.service'] = service;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { clientName: rx }];
    }
    const [items, total] = await Promise.all([
      Project.find(filter).sort({ updatedAt: -1 }).limit(200),
      Project.countDocuments(filter),
    ]);
    return res.status(200).json({ items, total });
  } catch (err) {
    return next(err);
  }
}

function paceOnTrack(p) {
  if (!p.startDate || !p.expectedCompletion) return true;
  const total = p.expectedCompletion - p.startDate;
  if (total <= 0) return true;
  const elapsed = Date.now() - p.startDate;
  const expected = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return (p.completion ?? 0) >= expected - 5;
}

export async function projectStats(_req, res, next) {
  try {
    const projects = await Project.find(
      {},
      { status: 1, completion: 1, branch: 1, currentStage: 1, scope: 1, startDate: 1, expectedCompletion: 1 },
    );
    const counts = { active: 0, onTrack: 0, completed: 0, onHold: 0, other: 0 };
    const byBranch = new Map();
    const byStage = new Map();
    const byService = new Map();
    for (const p of projects) {
      if (p.status === 'Active') {
        counts.active += 1;
        if (paceOnTrack(p)) counts.onTrack += 1;
      } else if (p.status === 'Completed') counts.completed += 1;
      else if (p.status === 'On Hold') counts.onHold += 1;
      else counts.other += 1;
      const b = byBranch.get(p.branch) ?? { projects: 0, completionSum: 0 };
      b.projects += 1;
      b.completionSum += p.completion ?? 0;
      byBranch.set(p.branch, b);
      byStage.set(p.currentStage, (byStage.get(p.currentStage) ?? 0) + 1);
      for (const s of p.scope ?? []) {
        if (s.service) byService.set(s.service, (byService.get(s.service) ?? 0) + 1);
      }
    }
    return res.status(200).json({
      counts,
      branches: [...byBranch.entries()].map(([branch, v]) => ({
        branch,
        projects: v.projects,
        avgCompletion:
          v.projects === 0 ? 0 : Math.round(v.completionSum / v.projects),
      })),
      byStage: [...byStage.entries()].map(([stage, count]) => ({
        stage,
        count,
      })),
      services: [...byService.entries()].map(([service, projects]) => ({
        service,
        projects,
      })),
      totals: { projects: projects.length, branches: byBranch.size },
    });
  } catch (err) {
    return next(err);
  }
}

export async function projectFilters(_req, res, next) {
  try {
    const [branches, statuses] = await Promise.all([
      Project.distinct('branch'),
      Project.distinct('status'),
    ]);
    return res.status(200).json({
      branches: branches.filter(Boolean).sort(),
      services: SERVICES,
      stages: STAGES,
      statuses: statuses.length > 0 ? statuses.sort() : PROJECT_STATUSES,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

export async function createProject(req, res, next) {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid project data.' });
    }
    const project = await Project.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
    });
    return res.status(201).json({ project });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A project with this code already exists.' });
    }
    return next(err);
  }
}

export async function updateProject(req, res, next) {
  try {
    const parsed = projectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid project data.' });
    }
    if (parsed.data.code) parsed.data.code = parsed.data.code.toUpperCase();
    const project = await Project.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A project with this code already exists.' });
    }
    return next(err);
  }
}
