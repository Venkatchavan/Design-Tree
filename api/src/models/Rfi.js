import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

const rfiSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    // Human-readable sequence (RFI-2026-014…) assigned on create via Counter.
    rfiNo: { type: String, trim: true, uppercase: true, index: true },
    type: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    team: { type: String, trim: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: String, trim: true },
    due: { type: Date },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Escalated', 'Responded', 'Closed'],
      default: 'Open',
      index: true,
    },
    // 13 Nov 2026: client / external RFIs. The SPOC registers the RFI received
    // by email and assigns it to the concerned team lead; the lead's response is
    // emailed automatically to the raiser with the SPOC and stakeholders in CC.
    kind: { type: String, enum: ['internal', 'client'], default: 'internal', index: true },
    service: { type: String, trim: true },
    subject: { type: String, trim: true },
    raiserName: { type: String, trim: true },
    raiserEmail: { type: String, trim: true, lowercase: true },
    raiserOrg: { type: String, trim: true },
    ccEmails: [{ type: String, trim: true, lowercase: true }],
    receivedOn: { type: Date },
    assignedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    spoc: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leadResponse: {
      text: { type: String, trim: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      _id: false,
    },
    emailLog: [{ type: String, trim: true }],
    history: [
      {
        action: { type: String, trim: true },
        note: { type: String, trim: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    clientResponse: {
      text: { type: String, trim: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      _id: false,
    },
  },
  { timestamps: true },
);

export const Rfi = mongoose.models.Rfi ?? mongoose.model('Rfi', auditProjectSchema(rfiSchema));
