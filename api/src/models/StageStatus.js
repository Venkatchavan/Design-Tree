import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

export const BILLING_READINESS = ['Billed', 'Ready for billing', 'Pending'];

// Per-project/service stage tracker + billing readiness (§4.4).
// Strict PTL submission → assigned SPOC confirmation → TD/ATD approval.
const stageStatusSchema = new mongoose.Schema(
  {
    // This counter is advanced only by atomic stage actions, including first save.
    __v: { type: Number, default: 0 },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    service: { type: String, trim: true },
    stage: { type: String, trim: true },
    startDate: Date,
    plannedCompletion: Date,
    baselineStartDate: Date,
    baselineCompletion: Date,
    actualCompletion: Date,
    approvalSequenceVerified: Boolean,
    timelineManaged: { type: Boolean, default: false },
    planRevisions: [{ startDate: Date, plannedCompletion: Date, previousStartDate: Date, previousPlannedCompletion: Date, reason: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
    currentStatus: { type: String, trim: true },
    delayDays: { type: Number, default: 0 },
    reason: { type: String, trim: true },
    billingReadiness: {
      type: String,
      enum: BILLING_READINESS,
      default: 'Pending',
      index: true,
    },
    confirmationStatus: {
      type: String,
      enum: ['None', 'PTL Requested', 'SPOC Confirmed', 'TD Approved'],
      default: 'None',
      index: true,
    },
    ptlRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ptlRequestedAt: { type: Date },
    ptlRemark: { type: String, trim: true },
    spocConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    spocConfirmedAt: { type: Date },
    spocRemark: { type: String, trim: true },
    tdApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tdApprovedAt: Date,
    tdRemark: String,
    history: [{ by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, action: String }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

stageStatusSchema.index({ project: 1, service: 1, stage: 1 }, { unique: true });

export const StageStatus =
  mongoose.models.StageStatus ??
  mongoose.model('StageStatus', auditProjectSchema(stageStatusSchema));
