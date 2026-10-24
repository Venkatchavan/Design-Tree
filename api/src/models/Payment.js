import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    // Optional service tag (see Claim.service).
    service: { type: String, trim: true, index: true },
    date: { type: Date, default: Date.now },
    reference: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Payment =
  mongoose.models.Payment ?? mongoose.model('Payment', auditProjectSchema(paymentSchema));
