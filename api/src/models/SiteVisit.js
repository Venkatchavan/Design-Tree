import mongoose from 'mongoose';

const siteVisitSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
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

export const SiteVisit =
  mongoose.models.SiteVisit ?? mongoose.model('SiteVisit', siteVisitSchema);
