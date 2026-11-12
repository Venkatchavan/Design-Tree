import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

// 'Awaiting' replaced 'Resubmit' (client list 11-11-2026). The legacy value
// stays readable in the model enum until migrate-drawing-resubmit has run.
export const DRAWING_STATUSES = ['Revise', 'Awaiting', 'Approved'];
export const LEGACY_DRAWING_STATUSES = ['Resubmit'];
// Who an "Awaiting" drawing is waiting on.
export const AWAITING_TARGETS = ['Client', 'Architect', 'Peer Review', 'STR', 'PHE', 'ELE', 'HVAC', 'F&LS'];

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
    // Review status set by the team lead: Revise / Awaiting / Approved.
    status: { type: String, enum: [...DRAWING_STATUSES, ...LEGACY_DRAWING_STATUSES] },
    // Set only while status is Awaiting.
    awaitingOn: { type: String, enum: AWAITING_TARGETS },
    // What the lead asked for when sending the drawing back (or a note with the decision).
    statusRemark: { type: String, trim: true },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

drawingSchema.index({ project: 1, drawingNo: 1, rev: 1 }, { unique: true });

export const Drawing =
  mongoose.models.Drawing ?? mongoose.model('Drawing', auditProjectSchema(drawingSchema));
