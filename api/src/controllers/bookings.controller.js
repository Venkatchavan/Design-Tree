import { TravelBooking } from '../models/TravelBooking.js';
import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import {
  bookingSchema,
  bookingUpdateSchema,
  bookingRescheduleSchema,
  bookingCancelSchema,
} from '../validation/phase3.schema.js';
import {
  day,
  validDate,
  minor,
  rupees,
  upcoming,
  bookingStatus,
  RESCHEDULE_REASONS,
  CANCEL_REASONS,
  MODES,
  SEATS,
  rescheduleCost,
  cancellationCost,
  hasStayCosts,
  sameTravelDetail,
} from '../utils/travelBooking.js';
const populate = [
  {
    path: 'employee',
    select: 'firstName lastName empId designation department',
  },
  { path: 'project', select: 'name code' },
];
const snapshotKeys = [
  'fromCity',
  'toCity',
  'departureDate',
  'returnDate',
  'mode',
  'preferredSeat',
  'hotel',
  'location',
  'checkIn',
  'checkOut',
  'hotelDatesSameAsTravel',
];
const snapshot = (b) =>
  Object.fromEntries(
    snapshotKeys.map((k) => [
      k,
      ['departureDate', 'returnDate'].includes(k) ? day(b[k]) : (b[k] ?? null),
    ]),
  );
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function parse(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    if (schema === bookingSchema && !body?.employee)
      throw fail('Select an employee.');
    if (schema === bookingRescheduleSchema && !body?.reason)
      throw fail('Choose a reason for the reschedule.');
    if (schema === bookingCancelSchema && !body?.reason)
      throw fail('Choose a reason for cancelling.');
    throw fail('Invalid booking data.', 400);
  }
  return parsed.data;
}
function validateDetails(before, changes, creating = false) {
  const next = { ...before, ...changes };
  if (creating && !next.employee) throw fail('Select an employee.');
  if ((creating || 'toCity' in changes) && !next.toCity?.trim())
    throw fail('Add the To city.');
  if (creating || 'departureDate' in changes || 'returnDate' in changes) {
    if (
      !validDate(day(next.departureDate)) ||
      !validDate(day(next.returnDate)) ||
      ('departureDate' in changes && !validDate(changes.departureDate)) ||
      ('returnDate' in changes && !validDate(changes.returnDate))
    )
      throw fail('Add both the travel and return dates.');
    if (day(next.returnDate) < day(next.departureDate))
      throw fail('Return date cannot be before the travel date.');
  }
  if (
    changes.mode &&
    !MODES.includes(changes.mode) &&
    changes.mode !== before.mode
  )
    throw fail('Select Flight, Train, Bus or Car.');
  if (
    changes.preferredSeat &&
    !SEATS.includes(changes.preferredSeat) &&
    changes.preferredSeat !== before.preferredSeat
  )
    throw fail('Select a preferred seat.');
  if (
    next.hotelDatesSameAsTravel &&
    (creating ||
      ['departureDate', 'returnDate', 'hotelDatesSameAsTravel', 'hotel'].some(
        (k) => k in changes,
      ))
  ) {
    changes.checkIn = day(next.departureDate);
    changes.checkOut = day(next.returnDate);
  }
  Object.assign(next, changes);
  if (
    (next.hotel || next.checkIn || next.checkOut) &&
    (creating ||
      [
        'checkIn',
        'checkOut',
        'hotel',
        'hotelDatesSameAsTravel',
        'departureDate',
        'returnDate',
      ].some((k) => k in changes))
  ) {
    if (
      !validDate(next.checkIn) ||
      !validDate(next.checkOut) ||
      next.checkOut < next.checkIn
    )
      throw fail('Check the hotel check-in and check-out dates.');
    changes.nights = next.hotel
      ? (Date.parse(next.checkOut) - Date.parse(next.checkIn)) / 86400000
      : 0;
  } else if ('hotel' in changes && !next.hotel) changes.nights = 0;
  for (const k of ['transportFare', 'hotelAmount', 'extraCharges'])
    if (k in changes)
      changes[k] =
        k === 'extraCharges'
          ? minor(changes[k]) / 100
          : rupees(minor(changes[k]));
  return changes;
}
async function references(data, creating) {
  if (creating) {
    const employee = await Employee.findById(data.employee);
    if (!employee) throw fail('Select an employee.');
    data.department = employee.department || '';
  }
  if (data.project) {
    const p = await Project.findById(data.project);
    if (!p) throw fail('Select an existing project.');
  }
}
const present = (b) => ({
  ...b,
  displayStatus: bookingStatus(b),
  canReschedule: upcoming(b),
  canCancel: upcoming(b),
});
async function responseDoc(id) {
  const b = await TravelBooking.findById(id).populate(populate).lean();
  return present(b);
}
async function current(id, version) {
  const b = await TravelBooking.findById(id).lean();
  if (!b) throw fail('Not found.', 404);
  if ((b.__v ?? 0) !== version)
    throw fail('This booking changed. Reload it before saving.', 409);
  return b;
}
async function persist(b, changes, event) {
  const update = { $set: changes, $inc: { __v: 1 } };
  if (event) update.$push = { history: event };
  const version =
    b.__v == null
      ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] }
      : { __v: b.__v };
  const saved = await TravelBooking.findOneAndUpdate(
    { _id: b._id, ...version },
    update,
    { returnDocument: 'after', runValidators: true },
  );
  if (!saved) throw fail('This booking changed. Reload it before saving.', 409);
  return responseDoc(b._id);
}
function handler(fn) {
  return async (req, res, next) => {
    try {
      return await fn(req, res);
    } catch (error) {
      if (error.status)
        return res.status(error.status).json({ message: error.message });
      if (error.name === 'CastError')
        return res.status(400).json({ message: 'Invalid booking id.' });
      return next(error);
    }
  };
}
export const bookings = {
  list: handler(async (req, res) => {
    const filter = {};
    for (const k of ['employee', 'project', 'status'])
      if (req.query[k]) filter[k] = req.query[k];
    const page = Number(req.query.page ?? 1),
      requestedLimit = Number(req.query.limit ?? 200);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(requestedLimit) ||
      requestedLimit < 1 ||
      !Number.isSafeInteger((page - 1) * Math.min(requestedLimit, 500))
    )
      throw fail('Invalid booking pagination.');
    const limit = Math.min(500, requestedLimit);
    const [items, total] = await Promise.all([
      TravelBooking.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(populate)
        .lean(),
      TravelBooking.countDocuments(filter),
    ]);
    return res.json({
      items: items.map(present),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  }),
  get: handler(async (req, res) => {
    const b = await TravelBooking.findById(req.params.id)
      .populate(populate)
      .lean();
    if (!b) throw fail('Not found.', 404);
    return res.json({ item: present(b) });
  }),
  update: handler(async (req, res) => {
    const { expectedVersion, ...changes } = parse(
        bookingUpdateSchema,
        req.body,
      ),
      b = await current(req.params.id, expectedVersion);
    if (
      (b.history?.length || b.status === 'Cancelled') &&
      ['transportFare', 'hotelAmount'].some(
        (k) => k in changes && String(changes[k]) !== String(b[k] ?? ''),
      )
    )
      throw fail('Use the reschedule workflow to change recorded fares.');
    validateDetails(b, changes);
    await references(changes, false);
    return res.json({ item: await persist(b, changes) });
  }),
};
export const createBooking = handler(async (req, res) => {
  const data = parse(bookingSchema, req.body);
  if (data.hotelDatesSameAsTravel == null) data.hotelDatesSameAsTravel = true;
  validateDetails({}, data, true);
  await references(data, true);
  const b = await TravelBooking.create({
    ...data,
    status: 'Booked',
    createdBy: req.user.id,
  });
  return res.status(201).json({ item: await responseDoc(b._id) });
});
export const rescheduleBooking = handler(async (req, res) => {
  const data = parse(bookingRescheduleSchema, req.body),
    b = await current(req.params.id, data.expectedVersion);
  if (b.status === 'Cancelled')
    throw fail('A cancelled booking cannot be rescheduled.', 409);
  if (!upcoming(b))
    throw fail('Only trips with a future departure date may be rescheduled.');
  if (!RESCHEDULE_REASONS.includes(data.reason))
    throw fail('Choose a reason for the reschedule.');
  // Ignore semantically unchanged optional fields without writing unknowns as empty strings.
  for (const key of Object.keys(data.changes)) {
    if (sameTravelDetail(key, b[key], data.changes[key]))
      delete data.changes[key];
  }
  const changes = validateDetails(b, data.changes),
    after = { ...b, ...changes };
  if (snapshotKeys.every((key) => sameTravelDetail(key, b[key], after[key])))
    throw fail('Nothing has changed yet. Update the dates or details first.');
  if (!upcoming(after)) throw fail('Revised departure must be in the future.');
  let transport, stay;
  try {
    transport = rescheduleCost(data.transport, b.transportFare);
    stay = rescheduleCost(data.stay, b.hotelAmount);
  } catch (e) {
    throw fail(e.message);
  }
  if (
    !hasStayCosts(b) &&
    !after.hotel &&
    (stay.feeMinor || stay.originalMinor || stay.newMinor)
  )
    throw fail('Stay amounts require a hotel.');
  const costs = {
    feesMinor: (b.costs?.feesMinor || 0) + transport.feeMinor + stay.feeMinor,
    differenceMinor:
      (b.costs?.differenceMinor || 0) +
      transport.differenceMinor +
      stay.differenceMinor,
    extraCostMinor:
      (b.costs?.extraCostMinor || 0) +
      transport.extraCostMinor +
      stay.extraCostMinor,
  };
  if (Object.values(costs).some((x) => !Number.isSafeInteger(x)))
    throw fail('Accumulated cost is too large.');
  const event = {
    type: 'reschedule',
    actor: req.user.id,
    at: new Date(),
    reason: data.reason,
    note: data.note,
    before: snapshot(b),
    after: snapshot(after),
    transport,
    stay,
  };
  return res.json({
    item: await persist(
      b,
      {
        ...changes,
        status: 'Rescheduled',
        transportFare: rupees(transport.newMinor),
        hotelAmount: rupees(stay.newMinor),
        costs,
      },
      event,
    ),
  });
});
export const cancelBooking = handler(async (req, res) => {
  const data = parse(bookingCancelSchema, req.body),
    b = await current(req.params.id, data.expectedVersion);
  if (b.status === 'Cancelled')
    throw fail('This booking is already cancelled.', 409);
  if (!upcoming(b))
    throw fail('Only trips with a future departure date may be cancelled.');
  if (!CANCEL_REASONS.includes(data.reason))
    throw fail('Choose a reason for cancelling.');
  let transport, stay;
  try {
    transport = cancellationCost(data.transport, b.transportFare);
    stay = cancellationCost(data.stay, b.hotelAmount);
  } catch (e) {
    throw fail(e.message);
  }
  if (!hasStayCosts(b) && (stay.paidMinor || stay.feeMinor))
    throw fail('Stay amounts require a hotel.');
  const cancellation = {
    transport,
    stay,
    totalRefundMinor: transport.refundMinor + stay.refundMinor,
    totalFeesMinor: transport.feeMinor + stay.feeMinor,
    notRefundedMinor:
      transport.paidMinor +
      stay.paidMinor -
      transport.refundMinor -
      stay.refundMinor,
    previousFeesMinor: b.costs?.feesMinor || 0,
  };
  const event = {
    type: 'cancel',
    actor: req.user.id,
    at: new Date(),
    reason: data.reason,
    note: data.note,
    before: snapshot(b),
    after: snapshot(b),
    transport,
    stay,
  };
  return res.json({
    item: await persist(b, { status: 'Cancelled', cancellation }, event),
  });
});
export const bookingSummary = handler(async (_req, res) => {
  const rows = await TravelBooking.find().lean();
  const summary = {
    total: rows.length,
    nights: 0,
    booked: 0,
    rescheduled: 0,
    cancelled: 0,
    travelled: 0,
    upcoming: 0,
  };
  for (const b of rows) {
    summary.nights += b.nights || 0;
    const key = bookingStatus(b).toLowerCase();
    if (key in summary) summary[key]++;
    if (upcoming(b)) summary.upcoming++;
  }
  return res.json(summary);
});
