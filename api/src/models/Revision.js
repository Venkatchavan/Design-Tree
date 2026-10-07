import mongoose from 'mongoose';

export const REVISION_STATUSES = ['Open', 'Resubmitted', 'Cleared'];

const revisionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    stage: { type: String, trim: true },
    drawing: { type: String, trim: true },
    revNo: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    raisedBy: { type: String, trim: true },
    dateRaised: { type: Date, default: Date.now },
    resubmissionDue: { type: Date },
    details: { type: String, required: true, trim: true },
    notify: { type: Boolean, default: false },
    emailLog: [{ type: String, trim: true }],
    status: { type: String, enum: REVISION_STATUSES, default: 'Open', index: true },
    resubmittedAt: { type: Date },
    clearedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Revision =
  mongoose.models.Revision ?? mongoose.model('Revision', revisionSchema);
