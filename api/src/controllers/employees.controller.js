import bcrypt from 'bcryptjs';
import { ROLE_KEYS, USER_ADMIN_ROLES, isSuperRole } from '../config/roles.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import {
  employeeLoginSchema,
  employeeSchema,
  employeeUpdateSchema,
} from '../validation/employee.schema.js';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listEmployees(req, res, next) {
  try {
    const { branch, department, status, search } = req.query;
    const filter = {};
    if (branch) filter.branch = branch;
    if (department) filter.department = department;
    if (status) {
      const s = String(status).trim().toLowerCase();
      if (s === 'active') filter.status = 'Active';
      else if (s === 'on leave' || s === 'on-leave' || s === 'onleave') filter.status = 'On Leave';
      else if (s === 'exited') filter.status = 'Exited';
      else filter.status = status;
    }
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [
        { firstName: rx },
        { lastName: rx },
        { empId: rx },
        { email: rx },
        { designation: rx },
      ];
    }
    const [items, total] = await Promise.all([
      Employee.find(filter).sort({ createdAt: -1 }).limit(200),
      Employee.countDocuments(filter),
    ]);
    return res.status(200).json({ items, total });
  } catch (err) {
    return next(err);
  }
}

export async function employeeFilters(_req, res, next) {
  try {
    const [branches, departments, designations] = await Promise.all([
      Employee.distinct('branch'),
      Employee.distinct('department'),
      Employee.distinct('designation'),
    ]);
    return res.status(200).json({
      branches: branches.filter(Boolean).sort(),
      departments: departments.filter(Boolean).sort(),
      designations: designations.filter(Boolean).sort(),
    });
  } catch (err) {
    return next(err);
  }
}

export async function getEmployee(req, res, next) {
  try {
    const employee = await Employee.findById(req.params.id).populate(
      'user',
      'email role isActive',
    );
    if (!employee)
      return res.status(404).json({ message: 'Employee not found.' });
    return res.status(200).json({ employee });
  } catch (err) {
    return next(err);
  }
}

export async function createEmployee(req, res, next) {
  try {
    const { login, ...body } = req.body ?? {};
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid employee data.', errors: parsed.error.issues });
    }
    // Mandatory-4 on create: firstName (schema) + login email/password/role,
    // but only for callers who may provision logins. Others may create
    // login-less records (route guard currently limits POST to those roles).
    const callerRole = req.user?.role;
    const canProvisionLogin = isSuperRole(callerRole) || USER_ADMIN_ROLES.includes(callerRole);
    if (canProvisionLogin && login == null) {
      return res.status(400).json({ message: 'Login email, password and role are required.' });
    }
    let loginData = null;
    if (login != null) {
      const loginParsed = employeeLoginSchema.safeParse(login);
      if (!loginParsed.success) {
        return res.status(400).json({ message: 'Invalid login data.', errors: loginParsed.error.issues });
      }
      if (!ROLE_KEYS.includes(loginParsed.data.role)) {
        return res.status(400).json({ message: 'Unknown role.' });
      }
      const clash = await User.findOne({ email: loginParsed.data.email });
      if (clash) {
        return res
          .status(409)
          .json({ message: 'A login with this email already exists.' });
      }
      loginData = loginParsed.data;
    }

    let employee;
    try {
      employee = await Employee.create(parsed.data);
    } catch (err) {
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ message: 'An employee with this ID already exists.' });
      }
      throw err;
    }

    if (loginData) {
      try {
        const name = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || loginData.email;
        const user = await User.create({
          name,
          email: loginData.email,
          passwordHash: await bcrypt.hash(loginData.password, 10),
          role: loginData.role,
          employee: employee._id,
        });
        employee.user = user._id;
        await employee.save();
      } catch (err) {
        await Employee.findByIdAndDelete(employee._id);
        if (err?.code === 11000) {
          return res
            .status(409)
            .json({ message: 'A login with this email already exists.' });
        }
        throw err;
      }
    }

    const created = await Employee.findById(employee._id).populate(
      'user',
      'email role isActive',
    );
    return res.status(201).json({ employee: created });
  } catch (err) {
    return next(err);
  }
}

export async function updateEmployee(req, res, next) {
  try {
    const parsed = employeeUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid employee data.', errors: parsed.error.issues });
    }
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true, returnDocument: 'after', runValidators: true },
    ).populate('user', 'email role isActive');
    if (!employee)
      return res.status(404).json({ message: 'Employee not found.' });
    return res.status(200).json({ employee });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'An employee with this ID already exists.' });
    }
    return next(err);
  }
}
