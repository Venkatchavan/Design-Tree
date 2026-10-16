import mongoose from 'mongoose';

export const WEEKLY_REPORT_STATUSES = ['Submitted', 'Approved'];

// QA/QC weekly reports submitted by the team for QA/QC Specs Head approval.
// Visit counts are derived client-side from site visits (project + week).
const weeklyReportSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    weekStart: { type: Date, required: true, index: true },
    weekEnd: { type: Date },
    weekLabel: { type: String, trim: true },
    status: {
      type: String,
      enum: WEEKLY_REPORT_STATUSES,
      default: 'Submitted',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

weeklyReportSchema.index({ project: 1, weekStart: 1 }, { unique: true });

export const WeeklyReport =
  mongoose.models.WeeklyReport ??
  mongoose.model('WeeklyReport', weeklyReportSchema);
