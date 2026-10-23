import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

export const WORK_ITEM_TYPES = ['BOQ', 'BBS'];
export const WORK_ITEM_STATUSES = ['Approved', 'Revision required', 'Pending review', 'Awaiting info'];

// QS work item (BOQ / BBS) with its progress and team lead review status.
const workItemSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    wuNo: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    type: { type: String, enum: WORK_ITEM_TYPES, required: true },
    activity: { type: String, trim: true },
    subActivity: { type: String, trim: true },
    progressPct: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: WORK_ITEM_STATUSES,
      default: 'Pending review',
      index: true,
    },
    waitingOn: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

export const WorkItem =
  mongoose.models.WorkItem ?? mongoose.model('WorkItem', auditProjectSchema(workItemSchema));
