import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

export const BOOKING_STATUSES = [
  'Booked',
  'Pending',
  'Approved',
  'Confirmed',
  'Rejected',
  'Rescheduled',
  'Cancelled',
  'Completed',
];

const feeSchema = new mongoose.Schema(
  {
    originalMinor: Number,
    newMinor: Number,
    feeMinor: Number,
    differenceMinor: Number,
    extraCostMinor: Number,
    paidMinor: Number,
    refundMinor: Number,
  },
  { _id: false },
);
const eventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['reschedule', 'cancel'], required: true },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    at: { type: Date, required: true },
    reason: { type: String, required: true },
    note: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    transport: feeSchema,
    stay: feeSchema,
  },
  { _id: false },
);
const cancellationSchema = new mongoose.Schema(
  {
    transport: feeSchema,
    stay: feeSchema,
    totalRefundMinor: Number,
    notRefundedMinor: Number,
    totalFeesMinor: Number,
    previousFeesMinor: Number,
  },
  { _id: false },
);
const travelBookingSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    department: { type: String, trim: true },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    fromCity: { type: String, trim: true },
    toCity: { type: String, trim: true },
    departureDate: { type: Date },
    returnDate: { type: Date },
    mode: { type: String, trim: true },
    preferredSeat: { type: String, trim: true },
    checkIn: { type: String, trim: true },
    checkOut: { type: String, trim: true },
    hotel: { type: String, trim: true },
    location: { type: String, trim: true },
    nights: { type: Number, min: 0, default: 0 },
    reason: { type: String, trim: true },
    extraCharges: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'Pending',
      index: true,
    },
    transportFare: { type: String },
    hotelAmount: { type: String },
    hotelDatesSameAsTravel: { type: Boolean },
    history: { type: [eventSchema], default: undefined },
    costs: {
      feesMinor: Number,
      differenceMinor: Number,
      extraCostMinor: Number,
    },
    cancellation: cancellationSchema,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const TravelBooking =
  mongoose.models.TravelBooking ??
  mongoose.model('TravelBooking', auditProjectSchema(travelBookingSchema));
