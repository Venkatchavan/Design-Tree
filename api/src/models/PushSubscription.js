import mongoose from 'mongoose';

// One row per browser/device a user has enabled push on. The endpoint is a
// bearer-style secret (anyone holding it can address that browser), so it is
// only ever returned to the server that created it — never to other users.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    expirationTime: { type: Number },
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

export const PushSubscription =
  mongoose.models.PushSubscription ??
  mongoose.model('PushSubscription', pushSubscriptionSchema);
