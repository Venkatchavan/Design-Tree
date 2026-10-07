import { SupportTicket } from '../models/SupportTicket.js';
import { User } from '../models/User.js';
import { makeCrud } from '../utils/crud.js';
import {
  supportSchema,
  supportUpdateSchema,
} from '../validation/phase4.schema.js';

const POP_EMP = 'firstName lastName empId designation department';

async function resolveEmployee(req, explicitId) {
  if (explicitId) {
    const { Employee } = await import('../models/Employee.js');
    return Employee.findById(explicitId);
  }
  const me = await User.findById(req.user.id);
  if (!me?.employee) return null;
  const { Employee } = await import('../models/Employee.js');
  return Employee.findById(me.employee);
}

export const tickets = makeCrud(SupportTicket, {
  create: supportSchema,
  filters: (req) => {
    const f = {};
    if (req.query.kind) f.kind = req.query.kind;
    if (req.query.status) f.status = req.query.status;
    if (req.query.employee) f.employee = req.query.employee;
    return f;
  },
  populate: [{ path: 'employee', select: POP_EMP }],
});

export async function createTicket(req, res, next) {
  const parsed = supportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const employee = await resolveEmployee(req, parsed.data.employee);
    if (!employee) {
      return res.status(400).json({ message: 'No linked employee record.' });
    }
    const doc = await SupportTicket.create({
      ...parsed.data,
      employee: employee._id,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function myTickets(req, res, next) {
  try {
    const me = await User.findById(req.user.id);
    if (!me?.employee) return res.status(200).json({ items: [], total: 0 });
    const items = await SupportTicket.find({ employee: me.employee })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function updateTicket(req, res, next) {
  const parsed = supportUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await SupportTicket.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (parsed.data.status) {
      doc.status = parsed.data.status;
      if (parsed.data.status === 'Issued') doc.issuedAt = new Date();
    }
    if (parsed.data.assignedTo !== undefined)
      doc.assignedTo = parsed.data.assignedTo;
    if (parsed.data.remark) {
      doc.remarks.push({ by: req.user.id, text: parsed.data.remark });
    }
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
