import mongoose from 'mongoose';
import { auditProjectSchema } from '../utils/projectAudit.js';
export const COORDINATION_SERVICES = [
  'Structural',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'QS',
  'QA/QC',
  'BIM',
  'GBS',
  'Peer Review',
];
const schema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['Internal team', 'Client', 'Architect', 'PMC', 'Peer Review'],
      required: true,
    },
    service: {
      type: String,
      enum: COORDINATION_SERVICES,
      required: true,
      index: true,
    },
    topic: { type: String, required: true, trim: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export const CoordinationItem =
  mongoose.models.CoordinationItem ??
  mongoose.model('CoordinationItem', auditProjectSchema(schema));
