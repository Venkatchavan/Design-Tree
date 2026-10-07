import mongoose from 'mongoose';

const conveyanceSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    purpose: { type: String, trim: true },
    area: { type: String, trim: true },
    vehicle: { type: String, trim: true },
    kilometers: { type: Number, min: 0 },
    amount: { type: Number, min: 0 },
    document: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Settled'],
      default: 'Pending',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Conveyance =
  mongoose.models.Conveyance ??
  mongoose.model('Conveyance', conveyanceSchema);
