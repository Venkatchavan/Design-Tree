import { auditProjectSchema } from '../utils/projectAudit.js';
import mongoose from 'mongoose';

// 13 Nov 2026: DBR (Design Basis Report) workflow, one record per project + service.
//   Engineer prepares the DBR details (entered by / with the TL)
//   → Team Lead reviews: Reviewed / Changes Required / Revised, forwards to SPOC
//   → SPOC shares with the client by email
//   → Client: Approved (SPOC updates) or Revision Required (back to the TL)
//   → revised details are re-shared until approval.
export const DBR_STATUSES = [
  'Under TL Review',
  'Changes Required',
  'Revised',
  'Reviewed',
  'Forwarded to SPOC',
  'Under Client Review',
  'Revision Required',
  'Approved',
];
export const DBR_CLIENT_STATUSES = ['Not shared', 'Awaiting Response', 'Approved', 'Revision Required'];

const dbrSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    service: { type: String, trim: true, default: 'STR' },
    title: { type: String, trim: true, default: 'Design Basis Report' },
    details: { type: String, trim: true },
    reference: { type: String, trim: true },
    engineer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    status: { type: String, enum: DBR_STATUSES, default: 'Under TL Review', index: true },
    reviewRemarks: { type: String, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    forwardedAt: { type: Date },
    forwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientEmail: { type: String, trim: true, lowercase: true },
    sharedAt: { type: Date },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientStatus: { type: String, enum: DBR_CLIENT_STATUSES, default: 'Not shared' },
    clientComments: { type: String, trim: true },
    clientRespondedAt: { type: Date },
    approvedAt: { type: Date },
    revisionCount: { type: Number, default: 0 },
    emailLog: [{ type: String, trim: true }],
    log: [
      {
        action: { type: String, trim: true },
        note: { type: String, trim: true },
        actor: { type: String, trim: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true },
);

dbrSchema.index({ project: 1, service: 1 }, { unique: true });

export const Dbr = mongoose.models.Dbr ?? mongoose.model('Dbr', auditProjectSchema(dbrSchema));
