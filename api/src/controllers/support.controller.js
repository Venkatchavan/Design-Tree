import { notify, userIdsForEmployees } from '../models/Notification.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { User } from '../models/User.js';
import { isSuperRole } from '../config/roles.js';

async function requesterUsers(doc) {
  const ids = new Set();
  if (doc.createdBy) ids.add(String(doc.createdBy?._id ?? doc.createdBy));
  if (doc.employee) {
    try {
      const found = await userIdsForEmployees([doc.employee]);
      for (const u of found) ids.add(String(u));
    } catch {
      /* best-effort */
    }
  }
  return [...ids];
}
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
    if (!employee && !isSuperRole(req.user?.role)) {
      return res.status(400).json({ message: 'No linked employee record.' });
    }
    const doc = await SupportTicket.create({
      ...parsed.data,
      ...(employee ? { employee: employee._id } : {}),
      createdBy: req.user.id,
    });
    notify({
      roles: ['hr', 'admin_billing'],
      link: { view: 'support', id: String(doc._id) },
      title: `Support ticket: ${parsed.data.kind ?? 'request'}`,
      detail: `${parsed.data.subject ?? ''}`.slice(0, 120),
      type: 'support',
    }).catch(() => {});
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function myTickets(req, res, next) {
  try {
    const me = await User.findById(req.user.id);
    const filter = me?.employee ? { employee: me.employee } : { createdBy: me?._id ?? req.user.id };
    const items = await SupportTicket.find(filter)
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
    try {
      const recipients = (await requesterUsers(doc)).filter((u) => u !== String(req.user.id));
      if (recipients.length > 0) {
        await notify({
          users: recipients,
          link: { view: 'support', id: String(doc._id) },
          title: `Support update: ${doc.kind ?? 'ticket'} ${doc.status ?? ''}`.trim(),
          detail: (parsed.data.remark ?? '').slice(0, 140),
          type: 'support',
        });
      }
    } catch {
      /* bell/push best-effort only */
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
