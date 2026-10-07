import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    section: { type: String, trim: true },
    item: { type: String, trim: true },
    requirement: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Pass', 'Fail', 'N/A'],
      default: 'Pending',
    },
    reviewer: { type: String, trim: true },
    remarks: { type: String, trim: true },
    date: { type: Date },
  },
  { timestamps: true },
);

const commentSchema = new mongoose.Schema(
  {
    no: { type: String, trim: true },
    docRef: { type: String, trim: true },
    observation: { type: String, required: true, trim: true },
    reviewer: { type: String, trim: true },
    respEngineer: { type: String, trim: true },
    actionRequired: { type: String, trim: true },
    response: { type: String, trim: true },
    rev: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    closureStatus: {
      type: String,
      enum: ['Open', 'Closed', 'Re-opened'],
      default: 'Open',
    },
    verifiedBy: { type: String, trim: true },
    closureDate: { type: Date },
  },
  { timestamps: true },
);

const peerReviewSchema = new mongoose.Schema(
  {
    jobNo: { type: String, trim: true },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    stage: { type: String, trim: true },
    discipline: { type: String, trim: true },
    submission: { type: String, trim: true },
    reviewer: { type: String, trim: true },
    respEngineer: { type: String, trim: true },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Overdue', 'Approved for Issue'],
      default: 'Pending',
      index: true,
    },
    checklist: [checklistItemSchema],
    comments: [commentSchema],
    finalVerified: { type: Boolean, default: false },
    finalApproved: { type: Boolean, default: false },
    issuedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const PeerReview =
  mongoose.models.PeerReview ??
  mongoose.model('PeerReview', peerReviewSchema);
