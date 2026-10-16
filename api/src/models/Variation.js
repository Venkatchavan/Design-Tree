import mongoose from 'mongoose';

export const VARIATION_APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'];

// Six-step variation workflow; a variation sits at one step at a time.
export const VARIATION_STEPS = [
  'Additional requirement identified',
  'Technical team records variation',
  'Technical or management approval',
  'Billing impact identified',
  'Billing team notified',
  'Additional work added to billing',
];

const variationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    service: { type: String, trim: true },
    reason: { type: String, trim: true },
    effectiveDate: { type: Date },
    areaChange: { type: String, trim: true },
    requestedBy: { type: String, trim: true },
    additionalScope: { type: String, trim: true },
    approvalStatus: {
      type: String,
      enum: VARIATION_APPROVAL_STATUSES,
      default: 'Pending',
      index: true,
    },
    currentStep: { type: Number, min: 1, max: VARIATION_STEPS.length, default: 1 },
  },
  { timestamps: true },
);

export const Variation =
  mongoose.models.Variation ?? mongoose.model('Variation', variationSchema);
