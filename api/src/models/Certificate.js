import mongoose from 'mongoose';

export const CERT_STATUSES = ['Issued', 'Requested', 'Uploaded', 'Pending'];

const certificateSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    certType: { type: String, required: true, trim: true },
    stage: { type: String, trim: true },
    status: {
      type: String,
      enum: CERT_STATUSES,
      default: 'Issued',
      index: true,
    },
    issuedDate: { type: Date, default: Date.now },
    issuedBy: { type: String, trim: true },
    file: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const templateSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, unique: true },
    file: { type: String, required: true, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const certRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Sent', 'Uploaded', 'Closed'],
      default: 'Sent',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Certificate =
  mongoose.models.Certificate ??
  mongoose.model('Certificate', certificateSchema);
export const CertTemplate =
  mongoose.models.CertTemplate ??
  mongoose.model('CertTemplate', templateSchema);
export const CertRequest =
  mongoose.models.CertRequest ??
  mongoose.model('CertRequest', certRequestSchema);
