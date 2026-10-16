import mongoose from 'mongoose';

export const BOOKING_STATUSES = [
  'Pending',
  'Approved',
  'Confirmed',
  'Rejected',
  'Rescheduled',
  'Cancelled',
  'Completed',
];

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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const TravelBooking =
  mongoose.models.TravelBooking ??
  mongoose.model('TravelBooking', travelBookingSchema);
