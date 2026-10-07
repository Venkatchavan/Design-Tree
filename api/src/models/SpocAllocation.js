import mongoose from 'mongoose';

// SPOC ↔ project allocation (§5.1 step 17, §4.22 Project Directory).
const spocAllocationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    services: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['Proposed', 'Approved'],
      default: 'Proposed',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

spocAllocationSchema.index({ project: 1, coordinator: 1 }, { unique: true });

export const SpocAllocation =
  mongoose.models.SpocAllocation ??
  mongoose.model('SpocAllocation', spocAllocationSchema);
