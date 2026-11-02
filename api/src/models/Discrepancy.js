import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

const discrepancySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    // Human-readable sequence (DA-2026-01…) assigned on create via Counter.
    discId: { type: String, trim: true, uppercase: true, index: true },
    // Construction vs Drawing discrepancy tracking.
    kind: {
      type: String,
      enum: ['Construction', 'Drawing'],
      default: 'Construction',
    },
    discipline: { type: String, trim: true },
    // Other discipline the coordination item is raised with.
    withDiscipline: { type: String, trim: true },
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
    // Set when raised automatically from a site visit that found a drawing issue.
    siteVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteVisit', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Discrepancy =
  mongoose.models.Discrepancy ??
  mongoose.model('Discrepancy', auditProjectSchema(discrepancySchema));
