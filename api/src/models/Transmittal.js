import mongoose from 'mongoose';

export const TRANSMITTAL_STATUSES = [
  'Pending',
  'Prepared',
  'Sent',
  'Acknowledged',
  'Returned for revision',
  'Cancelled',
];
export const TRANSMITTAL_RECIPIENTS = [
  'Client',
  'Architect',
  'PMC',
  'Contractor',
  'Authority',
  'Other',
];
export const TRANSMITTAL_METHODS = [
  'Portal',
  'Email',
  'Courier',
  'Hand delivery',
  'Transmittal',
];

const historySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, trim: true },
    detail: { type: String, trim: true },
    _id: false,
  },
);

// Admin transmittal log (§4.10): GFC drawings shared by TLs, issued with
// auto TR numbers, tracked to acknowledgement.
const transmittalSchema = new mongoose.Schema(
  {
    trNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    date: { type: Date, default: Date.now },
    drawing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drawing',
      required: true,
      index: true,
    },
    rev: { type: String, trim: true },
    issuedTo: { type: String, enum: TRANSMITTAL_RECIPIENTS, required: true },
    method: { type: String, enum: TRANSMITTAL_METHODS, required: true },
    status: {
      type: String,
      enum: TRANSMITTAL_STATUSES,
      default: 'Pending',
      index: true,
    },
    sentAt: { type: Date },
    ackAt: { type: Date },
    handledBy: { type: String, trim: true },
    remarks: { type: String, trim: true },
    source: {
      type: String,
      enum: ['manual', 'tl-list', 'import'],
      default: 'manual',
    },
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportBatch',
    },
    history: [historySchema],
  },
  { timestamps: true },
);

transmittalSchema.index(
  { drawing: 1, rev: 1, trNo: 1 },
  { unique: true },
);

export const Transmittal =
  mongoose.models.Transmittal ??
  mongoose.model('Transmittal', transmittalSchema);
