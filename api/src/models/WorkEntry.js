import mongoose from 'mongoose';

export const WORK_ENTRY_TYPES = ['Regular', 'Revision', 'Rework'];
export const WORK_ENTRY_STATUSES = ['Pending', 'Approved', 'Needs Attention'];

// Minimal daily hours record backing Teams rosters, HR Login Hours and
// (Phase 2) the full work-update flow with WU numbering on top.
const workEntrySchema = new mongoose.Schema(
  {
    refNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    stage: { type: String, trim: true },
    date: { type: Date, required: true, index: true },
    hours: { type: Number, required: true, min: 0, max: 24 },
    type: { type: String, enum: WORK_ENTRY_TYPES, default: 'Regular' },
    notes: { type: String, trim: true },
    wuNo: { type: String, trim: true, uppercase: true, index: true },
    category: {
      type: String,
      enum: ['Assigned Daily Work', 'Hourly', 'Drawing', 'Task'],
    },
    deliverable: { type: String, trim: true },
    taskActivity: { type: String, trim: true },
    drawing: { type: String, trim: true },
    progressPct: { type: Number, min: 0, max: 100 },
    otherHours: [
      {
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        hours: { type: Number, min: 0, max: 24 },
        _id: false,
      },
    ],
    status: {
      type: String,
      enum: WORK_ENTRY_STATUSES,
      default: 'Pending',
      index: true,
    },
    // Required when the day's total logged hours exceed 8 (extra hours).
    extraHoursReason: { type: String, trim: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    remark: { type: String, trim: true },
  },
  { timestamps: true },
);

workEntrySchema.pre('validate', function autoRef() {
  if (!this.refNo) {
    this.refNo = `WE-${Date.now().toString(36).toUpperCase()}`;
  }
});

export const WorkEntry =
  mongoose.models.WorkEntry ?? mongoose.model('WorkEntry', workEntrySchema);
