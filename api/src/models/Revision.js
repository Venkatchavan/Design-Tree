import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

// Open        – logged by the lead and allotted to a team member
// Resubmitted – the team member has addressed it; the lead must now act
// Revise      – the lead sent it back, with instructions in leadNote
// Cleared     – approved by the lead
export const REVISION_STATUSES = ['Open', 'Resubmitted', 'Revise', 'Cleared'];

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
    priority: { type: String, enum: ['Normal', 'High', 'Urgent'], default: 'Normal' },
    notifyEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    emailLog: [{ type: String, trim: true }],
    // 13 Nov 2026: service the revision belongs to, and the service heads
    // (PTL / ATD / TD / AD) plus EDs / Founding Directors notified automatically.
    service: { type: String, trim: true, index: true },
    autoNotified: [
      {
        name: { type: String, trim: true },
        email: { type: String, trim: true },
        label: { type: String, trim: true },
        service: { type: String, trim: true },
        emailed: { type: Boolean, default: false },
        _id: false,
      },
    ],
    status: { type: String, enum: REVISION_STATUSES, default: 'Open', index: true },
    resubmittedAt: { type: Date },
    clearedAt: { type: Date },
    // What the lead asked to be revised (latest), and every step taken.
    leadNote: { type: String, trim: true },
    reviewLog: [
      {
        action: { type: String, trim: true },
        note: { type: String, trim: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Revision =
  mongoose.models.Revision ?? mongoose.model('Revision', auditProjectSchema(revisionSchema));
