import bcrypt from 'bcryptjs';
import { ROLE_KEYS, roleLabel } from '../config/roles.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
} from '../validation/user.schema.js';

function toPublicUser(u) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: roleLabel(u.role),
    isActive: u.isActive,
    employee: u.employee?._id?.toString?.() ?? u.employee ?? null,
  };
}

export async function listUsers(req, res, next) {
  try {
    const { role, active, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;
    if (search) {
      const rx = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).limit(200),
      User.countDocuments(filter),
    ]);
    return res.status(200).json({ items: items.map(toPublicUser), total });
  } catch (err) {
    return next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid user data.' });
    }
    if (!ROLE_KEYS.includes(parsed.data.role)) {
      return res.status(400).json({ message: 'Unknown role.' });
    }
    const clash = await User.findOne({ email: parsed.data.email });
    if (clash) {
      return res
        .status(409)
        .json({ message: 'A login with this email already exists.' });
    }
    let employee = null;
    if (parsed.data.employeeId) {
      employee = await Employee.findById(parsed.data.employeeId);
      if (!employee)
        return res.status(404).json({ message: 'Employee not found.' });
    }
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role,
      employee: employee?._id,
    });
    if (employee) {
      employee.user = user._id;
      await employee.save();
    }
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A login with this email already exists.' });
    }
    return next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const parsed = adminUpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid user data.' });
    }
    if (parsed.data.role && !ROLE_KEYS.includes(parsed.data.role)) {
      return res.status(400).json({ message: 'Unknown role.' });
    }
    const patch = {};
    if (parsed.data.role) patch.role = parsed.data.role;
    if (parsed.data.isActive !== undefined)
      patch.isActive = parsed.data.isActive;
    if (parsed.data.password)
      patch.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    return next(err);
  }
}
