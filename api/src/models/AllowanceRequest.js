import mongoose from 'mongoose';

export const ALLOWANCE_TYPES = ['LA', 'Cab', 'Other'];
export const ALLOWANCE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed', 'Returned for clarification'];

const allowanceRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    reqType: { type: String, enum: ALLOWANCE_TYPES, required: true },
    date: { type: Date, default: Date.now },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    amount: { type: Number, min: 0, default: 0 },
    days: { type: Number, min: 0, default: 0 },
    route: { type: String, trim: true },
    pickup: { type: String, trim: true },
    drop: { type: String, trim: true },
    meetingTime: { type: String, trim: true },
    vehicle: { type: String, trim: true },
    passengers: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true },
    purpose: { type: String, trim: true },
    bill: { type: String, trim: true },
    status: {
      type: String,
      enum: ALLOWANCE_STATUSES,
      default: 'Pending',
      index: true,
    },
    remarks: { type: String, trim: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const AllowanceRequest =
  mongoose.models.AllowanceRequest ??
  mongoose.model('AllowanceRequest', allowanceRequestSchema);
