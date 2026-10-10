import { Project } from '../models/Project.js';
import {
  ProjectDirectory,
  seedSectionsFromProject,
} from '../models/ProjectDirectory.js';
import { projectDirectorySchema } from '../validation/project.schema.js';
import { isSuperRole } from '../config/roles.js';

// Internal team members pass automatically; external Client/Architect pass
// only when the project shares directory access via portalUsers.
async function canReadDirectory(user, project) {
  if (isSuperRole(user.role)) return true;
  if (user.role !== 'client' && user.role !== 'architect') return true;
  const ids = (project.portalUsers ?? []).map(String);
  return ids.includes(String(user.id));
}

export async function getDirectory(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (!(await canReadDirectory(req.user, project))) {
      return res.status(403).json({ message: 'You do not have access to this area.' });
    }
    let doc = await ProjectDirectory.findOne({ project: project._id });
    const seeded = seedSectionsFromProject(project, doc?.sections);
    if (!doc) {
      doc = await ProjectDirectory.create({
        project: project._id,
        sections: seeded,
        updatedBy: req.user.id,
      });
    }
    return res.status(200).json({
      item: {
        project: project._id,
        sections: seeded,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function saveDirectory(req, res, next) {
  try {
    const parsed = projectDirectorySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid directory data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const seeded = seedSectionsFromProject(project, []);
    const titles = new Map(seeded.map((s) => [s.key, s.title]));
    const doc = await ProjectDirectory.findOneAndUpdate(
      { project: project._id },
      {
        project: project._id,
        sections: parsed.data.sections.map((s) => ({
          key: s.key,
          title: s.title ?? titles.get(s.key) ?? s.key,
          body: s.body ?? '',
        })),
        updatedBy: req.user.id,
      },
      { upsert: true, new: true, returnDocument: 'after', runValidators: true },
    );
    try {
      const { notify } = await import('../models/Notification.js');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Directory updated: ${project.name} (${project.code})`,
        detail: 'SPOC saved the project directory sections.',
        type: 'directory-updated',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
