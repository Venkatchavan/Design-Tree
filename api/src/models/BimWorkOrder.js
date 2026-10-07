import mongoose from 'mongoose';

const bimWorkOrderSchema = new mongoose.Schema(
  {
    woNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    scope: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    fee: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Completed', 'Closed'],
      default: 'Open',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const BimWorkOrder =
  mongoose.models.BimWorkOrder ??
  mongoose.model('BimWorkOrder', bimWorkOrderSchema);
