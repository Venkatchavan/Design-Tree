import mongoose from 'mongoose';

const recipientSnapshot = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  branchName: String,
}, { _id: false });
const schema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: String,
  requestId: { type: String, required: true },
  contentHash: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  requireAcknowledgment: { type: Boolean, default: false },
  audience: { type: String, default: 'all-branches', enum: ['all-branches'] },
  recipients: { type: [recipientSnapshot], select: false },
  recipientCount: Number,
  branchSummary: [{ branchName: String, count: Number, _id: false }],
  status: { type: String, enum: ['pending', 'published'], default: 'pending', index: true },
  publishedAt: Date,
  leaseUntil: Date,
  leaseOwner: String,
  retryAt: Date,
  attempts: { type: Number, default: 0 },
  lastError: String,
}, { timestamps: true });
schema.index({ author: 1, requestId: 1 }, { unique: true });
export const Announcement = mongoose.models.Announcement ?? mongoose.model('Announcement', schema);
