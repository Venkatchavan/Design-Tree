import { Branch } from '../models/Branch.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import {
  branchSchema,
  branchUpdateSchema,
} from '../validation/branch.schema.js';
import { activeBranchNames } from '../utils/branches.js';

export async function listBranches(req, res, next) {
  try {
    const all = req.query.all === '1';
    const filter = all ? {} : { isActive: true };
    const items = await Branch.find(filter).sort({ name: 1 }).lean();
    if (!all) {
      return res.status(200).json({ items, total: items.length });
    }
    const withUsage = await Promise.all(
      items.map(async (b) => {
        const [projects, employees, teams] = await Promise.all([
          Project.countDocuments({ branch: b.name }),
          Employee.countDocuments({ branch: b.name }),
          Team.countDocuments({ branch: b.name }),
        ]);
        return { ...b, usage: { projects, employees, teams } };
      }),
    );
    return res.status(200).json({ items: withUsage, total: withUsage.length });
  } catch (err) {
    return next(err);
  }
}

export async function createBranch(req, res, next) {
  try {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid branch data.' });
    }
    try {
      const branch = await Branch.create({
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
      });
      return res.status(201).json({ branch });
    } catch (err) {
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ message: 'A branch with this name already exists.' });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
}

export async function updateBranch(req, res, next) {
  try {
    const parsed = branchUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid branch data.' });
    }
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ message: 'Branch not found.' });
    const oldName = branch.name;
    if (parsed.data.name !== undefined) branch.name = parsed.data.name;
    if (parsed.data.isActive !== undefined) branch.isActive = parsed.data.isActive;
    try {
      await branch.save();
    } catch (err) {
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ message: 'A branch with this name already exists.' });
      }
      throw err;
    }
    // Records store the branch name as a string — propagate renames so
    // existing projects/employees/teams keep pointing at the master entry.
    if (parsed.data.name !== undefined && branch.name !== oldName) {
      await Promise.all([
        Project.updateMany({ branch: oldName }, { $set: { branch: branch.name } }),
        Employee.updateMany({ branch: oldName }, { $set: { branch: branch.name } }),
        Team.updateMany({ branch: oldName }, { $set: { branch: branch.name } }),
      ]);
    }
    return res.status(200).json({ branch });
  } catch (err) {
    return next(err);
  }
}

export async function branchOptions(_req, res, next) {
  try {
    const items = await activeBranchNames();
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}
