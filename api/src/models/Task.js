import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

export const TASK_STATUSES = [
  'Open',
  'In Progress',
  'Submitted',
  'Approved',
  'Needs Attention',
];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const taskSchema = new mongoose.Schema(
  {
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    ],
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    stage: { type: String, trim: true },
    deliverable: { type: String, trim: true },
    dueDate: { type: Date },
    // 06 Nov 2026: each extension of the due date, with the reason, so the task
    // is extended instead of being entered again.
    dueDateHistory: [{
      _id: false,
      from: Date,
      to: Date,
      reason: { type: String, trim: true, maxlength: 1000 },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    }],
    priority: { type: String, enum: TASK_PRIORITIES, default: 'Medium' },
    notes: { type: String, trim: true },
    status: { type: String, enum: TASK_STATUSES, default: 'Open', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Set once the due-soon / overdue bell alerts went out, so each fires once.
    dueSoonNotifiedAt: { type: Date },
    overdueNotifiedAt: { type: Date },
  },
  { timestamps: true },
);

export const Task =
  mongoose.models.Task ?? mongoose.model('Task', auditProjectSchema(taskSchema));
