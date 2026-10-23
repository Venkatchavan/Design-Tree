import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

export const STAGE_REVIEW_OUTCOMES = ['Pending', 'Approved', 'Approved with comments', 'Rejected'];

// Cross-discipline technical director review of a stage output before client issue.
const stageReviewSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    date: { type: Date },
    stage: { type: String, trim: true },
    reviewer: { type: String, trim: true },
    waitingOn: { type: String, trim: true },
    outcome: {
      type: String,
      enum: STAGE_REVIEW_OUTCOMES,
      default: 'Pending',
      index: true,
    },
  },
  { timestamps: true },
);

export const StageReview =
  mongoose.models.StageReview ?? mongoose.model('StageReview', auditProjectSchema(stageReviewSchema));
