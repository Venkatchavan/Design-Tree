import { z } from 'zod';
import { Employee } from '../models/Employee.js';
import { EmployeeMeeting } from '../models/EmployeeMeeting.js';

const meetingTypes = ['1:1 check-in', 'Team meeting', 'Disciplinary', 'Performance review'];
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const employeeMeetingSchema = z
  .object({
    employee: objectId,
    date: z.coerce.date(),
    type: z.enum(meetingTypes),
    topic: z.string().trim().min(1).max(300),
    conductedBy: z.string().trim().min(1).max(160),
    notes: z.string().trim().min(1).max(5000),
  })
  .strict();

export async function listEmployeeMeetings(req, res, next) {
  try {
    const filter = {};
    if (req.query.employee) {
      const parsedId = objectId.safeParse(req.query.employee);
      if (!parsedId.success) {
        return res.status(400).json({ message: 'Invalid employee ID.' });
      }
      filter.employee = parsedId.data;
    }
    const items = await EmployeeMeeting.find(filter)
      .populate('employee', 'firstName lastName empId department designation')
      .sort({ date: -1, createdAt: -1 })
      .limit(500);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function createEmployeeMeeting(req, res, next) {
  const parsed = employeeMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Invalid meeting details.',
    });
  }
  try {
    const employee = await Employee.findById(parsed.data.employee).select('_id');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }
    const item = await EmployeeMeeting.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    await item.populate('employee', 'firstName lastName empId department designation');
    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
}
