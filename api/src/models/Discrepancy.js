import mongoose from 'mongoose';

const discrepancySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    discipline: { type: String, trim: true },
    severity: { type: String, trim: true },
    issue: { type: String, required: true, trim: true },
    raised: { type: Date, default: Date.now },
    due: { type: Date },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Closed'],
      default: 'Open',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Discrepancy =
  mongoose.models.Discrepancy ??
  mongoose.model('Discrepancy', discrepancySchema);
