import mongoose from 'mongoose';

const areaSettlementSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    zone: { type: String, required: true, trim: true },
    initial: { type: Number, required: true, min: 0 },
    revised: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewRemark: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const AreaSettlement =
  mongoose.models.AreaSettlement ??
  mongoose.model('AreaSettlement', areaSettlementSchema);
