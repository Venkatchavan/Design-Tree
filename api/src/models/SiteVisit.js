import mongoose from 'mongoose';
import { Counter } from './Counter.js';
import { Discrepancy } from './Discrepancy.js';

const siteVisitSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    // Human-readable sequence (SV-2026-001…) assigned on create via Counter.
    visitId: { type: String, trim: true, uppercase: true, index: true },
    // Construction phase context (e.g. Construction, Initial).
    phase: { type: String, trim: true },
    visitType: { type: String, required: true, trim: true },
    date: { type: Date, default: Date.now },
    photos: [{ type: String, trim: true }],
    remarksClient: { type: String, trim: true },
    remarksDesigner: { type: String, trim: true },
    additionalVisit: { type: Boolean, default: false },
    discrepancyFound: { type: Boolean, default: false },
    severity: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Logged', 'Reported', 'Approved'],
      default: 'Logged',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// A visit that finds a drawing discrepancy raises a designer alert: a
// Drawing discrepancy linked to the visit, created once.
async function raiseDrawingAlert(visit) {
  if (!visit?.discrepancyFound) return;
  if (await Discrepancy.exists({ siteVisit: visit._id })) return;
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { name: `discrepancy-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  await Discrepancy.create({
    project: visit.project,
    discId: `DA-${year}-${String(counter.seq).padStart(2, '0')}`,
    kind: 'Drawing',
    severity: visit.severity || undefined,
    issue: visit.remarksDesigner || visit.remarksClient || `Drawing discrepancy found on site visit ${visit.visitId ?? ''}`.trim(),
    raised: visit.date,
    status: 'Open',
    siteVisit: visit._id,
  });
}

siteVisitSchema.post('save', raiseDrawingAlert);
siteVisitSchema.post('findOneAndUpdate', raiseDrawingAlert);

export const SiteVisit =
  mongoose.models.SiteVisit ?? mongoose.model('SiteVisit', siteVisitSchema);
