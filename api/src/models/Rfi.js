import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

const rfiSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    // Human-readable sequence (RFI-2026-014…) assigned on create via Counter.
    rfiNo: { type: String, trim: true, uppercase: true, index: true },
    type: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    team: { type: String, trim: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: String, trim: true },
    due: { type: Date },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Escalated', 'Responded', 'Closed'],
      default: 'Open',
      index: true,
    },
    clientResponse: {
      text: { type: String, trim: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      _id: false,
    },
  },
  { timestamps: true },
);

export const Rfi = mongoose.models.Rfi ?? mongoose.model('Rfi', auditProjectSchema(rfiSchema));
