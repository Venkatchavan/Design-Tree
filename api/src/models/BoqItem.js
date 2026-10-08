import mongoose from 'mongoose';

// QS/BOQ line items. QS logs items (Draft → Submitted); QS Head reviews
// (Submitted → Approved). Feeds the GFC readiness checklist.
export const BOQ_STATUSES = ['Draft', 'Submitted', 'Approved'];

const boqItemSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    itemNo: { type: String, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    qty: { type: Number, min: 0 },
    rate: { type: Number, min: 0 },
    amount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: BOQ_STATUSES,
      default: 'Draft',
      index: true,
    },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

boqItemSchema.pre('validate', function autoAmount() {
  if ((this.qty ?? null) !== null && (this.rate ?? null) !== null) {
    this.amount = this.qty * this.rate;
  }
});

boqItemSchema.index({ project: 1, itemNo: 1 }, { unique: true, sparse: true });

export const BoqItem =
  mongoose.models.BoqItem ?? mongoose.model('BoqItem', boqItemSchema);
