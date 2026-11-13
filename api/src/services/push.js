// web-push v4 is ESM with named exports only (no default export).
import * as webpush from 'web-push';
import { config } from '../config/config.js';
import { PushSubscription } from '../models/PushSubscription.js';

// Web Push delivery for notify(). Strictly best-effort and additive: the
// bell record + socket.io emit stay the source of truth, so nothing here may
// throw into (or delay) the API call that raised the notification.

export const pushEnabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey);

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!pushEnabled) return false;
  try {
    webpush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey,
    );
    configured = true;
  } catch (err) {
    console.error('push: invalid VAPID configuration —', err.message);
    return false;
  }
  return true;
}

const TTL_SECONDS = 24 * 60 * 60; // undelivered pushes expire after a day
const MAX_PER_USER = 10; // newest devices kept per user
const CHUNK = 50;

function clip(s, n) {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// Same relevance rule as the bell feed: addressed to the reader's role OR to
// them personally. Inactive logins never get pushes.
async function recipientUserIds(doc) {
  const ids = new Set((doc.users ?? []).map((u) => String(u?._id ?? u)));
  const roles = (doc.roles ?? []).filter(Boolean);
  const { User } = await import('../models/User.js');
  const filter = { isActive: { $ne: false } };
  const or = [];
  if (roles.length) or.push({ role: { $in: roles } });
  if (ids.size) or.push({ _id: { $in: [...ids] } });
  if (!or.length) return [];
  const users = await User.find({ ...filter, $or: or }).select('_id').lean();
  return users.map((u) => String(u._id));
}

export async function sendPushForNotification(doc) {
  if (!doc || !ensureConfigured()) return;
  const userIds = await recipientUserIds(doc);
  if (!userIds.length) return;
  const subs = await PushSubscription.find({ user: { $in: userIds } }).lean();
  if (!subs.length) return;

  const payload = JSON.stringify({
    id: String(doc._id),
    title: clip(doc.title, 120) || 'DesignTree',
    body: clip(doc.detail, 200),
    link: doc.link?.view || doc.link?.id
      ? { view: doc.link.view, id: doc.link.id }
      : undefined,
  });

  for (let i = 0; i < subs.length; i += CHUNK) {
    await Promise.allSettled(
      subs.slice(i, i + CHUNK).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            payload,
            { TTL: TTL_SECONDS, urgency: 'normal' },
          );
        } catch (err) {
          // 404/410: the browser revoked or the user unsubscribed — prune.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
          } else if (config.nodeEnv !== 'production') {
            console.warn(`push: send failed (${err?.statusCode ?? err?.message})`);
          }
        }
      }),
    );
  }
}

// Keep only the newest MAX_PER_USER subscriptions for a user.
export async function pruneUserSubscriptions(userId) {
  const extra = await PushSubscription.find({ user: userId })
    .sort({ updatedAt: -1 })
    .skip(MAX_PER_USER)
    .select('_id')
    .lean();
  if (extra.length) {
    await PushSubscription.deleteMany({ _id: { $in: extra.map((e) => e._id) } });
  }
}
