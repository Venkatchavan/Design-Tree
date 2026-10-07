import mongoose from 'mongoose';

// In-app notifications (§2.5). Bell UI + read endpoints arrive in Phase 4;
// events already push records here so nothing is lost.
const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
    roles: [{ type: String, trim: true, index: true }],
    type: { type: String, trim: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });

export const Notification =
  mongoose.models.Notification ??
  mongoose.model('Notification', notificationSchema);

export async function notifyRoles(roles, { title, detail, type }) {
  if (!roles?.length) return null;
  return Notification.create({ title, detail, roles, type });
}
