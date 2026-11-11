import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

export const DRAWING_STATUSES = ['Revise', 'Resubmit', 'Approved'];

// TL-shared drawing register (basis for Phase 3 transmittals).
const drawingSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    drawingNo: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    service: { type: String, trim: true },
    stage: { type: String, trim: true },
    rev: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    issuedTo: { type: String, trim: true },
    method: { type: String, trim: true },
    // Email proof screenshot / PDF for a drawing submission (§4.2).
    proof: { type: String, trim: true },
    // Review status set by the team lead: Revise / Resubmit / Approved.
    status: { type: String, enum: DRAWING_STATUSES },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

drawingSchema.index({ project: 1, drawingNo: 1, rev: 1 }, { unique: true });

export const Drawing =
  mongoose.models.Drawing ?? mongoose.model('Drawing', auditProjectSchema(drawingSchema));
