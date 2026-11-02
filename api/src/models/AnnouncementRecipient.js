import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  announcement: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  branchName: String,
  readAt: { type: Date, default: null },
  acknowledgedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ announcement: 1, user: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1 });
export const AnnouncementRecipient = mongoose.models.AnnouncementRecipient ?? mongoose.model('AnnouncementRecipient', schema);
