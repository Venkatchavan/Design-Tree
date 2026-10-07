import mongoose from 'mongoose';

export const BILLING_READINESS = ['Billed', 'Ready for billing', 'Pending'];

// Per-project/service stage tracker + billing readiness (§4.4).
const stageStatusSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    service: { type: String, trim: true },
    stage: { type: String, trim: true },
    plannedCompletion: { type: Date },
    currentStatus: { type: String, trim: true },
    delayDays: { type: Number, default: 0 },
    reason: { type: String, trim: true },
    billingReadiness: {
      type: String,
      enum: BILLING_READINESS,
      default: 'Pending',
      index: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

stageStatusSchema.index({ project: 1, service: 1, stage: 1 }, { unique: true });

export const StageStatus =
  mongoose.models.StageStatus ??
  mongoose.model('StageStatus', stageStatusSchema);
