import mongoose from 'mongoose';

export const CLAIM_STATUSES = [
  'Pending',
  'Ready for billing',
  'Billed',
  'Flagged',
];

const claimSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    stage: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    submissionDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'Pending',
      index: true,
    },
    flagged: { type: Boolean, default: false },
    billedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Claim =
  mongoose.models.Claim ?? mongoose.model('Claim', claimSchema);
