import { TravelBooking } from '../models/TravelBooking.js';
import { makeCrud } from '../utils/crud.js';
import {
  bookingSchema,
  bookingStatusSchema,
  bookingUpdateSchema,
} from '../validation/phase3.schema.js';

export const bookings = makeCrud(TravelBooking, {
  create: bookingSchema,
  update: bookingUpdateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.status) f.status = req.query.status;
    if (req.query.employee) f.employee = req.query.employee;
    if (req.query.project) f.project = req.query.project;
    return f;
  },
  populate: [
    { path: 'employee', select: 'firstName lastName empId designation' },
    { path: 'project', select: 'name code' },
  ],
});

export async function createBooking(req, res, next) {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await TravelBooking.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setBookingStatus(req, res, next) {
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await TravelBooking.findByIdAndUpdate(
      req.params.id,
      { status: parsed.data.status },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function bookingSummary(_req, res, next) {
  try {
    const rows = await TravelBooking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          nights: { $sum: '$nights' },
        },
      },
    ]);
    const summary = {
      total: 0,
      nights: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      rescheduled: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      summary.total += r.count;
      summary.nights += r.nights ?? 0;
      const key = String(r._id ?? '').toLowerCase();
      if (key in summary) summary[key] = r.count;
    }
    return res.status(200).json(summary);
  } catch (err) {
    return next(err);
  }
}
