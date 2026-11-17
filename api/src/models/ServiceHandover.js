import mongoose from 'mongoose';

export const HANDOVER_STATUSES = ['Notified', 'Acknowledged'];

// 17 Nov 2026: the SPOC tells the next service that drawings of a completed
// service are ready to be passed on, and tracks whether that team has taken it up.
const serviceHandoverSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    fromService: { type: String, required: true, trim: true },
    toServices: [{ type: String, trim: true }],
    stage: { type: String, trim: true },
    note: { type: String, trim: true },
    status: { type: String, enum: HANDOVER_STATUSES, default: 'Notified', index: true },
    // Employees of the next service's team who were notified.
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true }],
    notifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true },
);

export const ServiceHandover = mongoose.model('ServiceHandover', serviceHandoverSchema);
