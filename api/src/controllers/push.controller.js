import { z } from 'zod';
import { config } from '../config/config.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { pruneUserSubscriptions, pushEnabled } from '../services/push.js';

const subscribeSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export function publicKey(_req, res) {
  return res.status(200).json({
    enabled: pushEnabled,
    publicKey: pushEnabled ? config.vapidPublicKey : null,
  });
}

// Upsert by endpoint: re-subscribing on a shared browser rebinds the device
// to whoever is signed in now, so the previous user stops receiving pushes.
export async function subscribe(req, res, next) {
  try {
    if (!pushEnabled) {
      return res.status(503).json({ message: 'Push notifications are not configured.' });
    }
    const parsed = subscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid push subscription.' });
    }
    const { endpoint, keys, expirationTime } = parsed.data;
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user.id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        expirationTime: expirationTime ?? undefined,
        userAgent: String(req.get('user-agent') ?? '').slice(0, 300),
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    await pruneUserSubscriptions(req.user.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

// Deliberately unauthenticated: it runs right after sign-out, when the
// session cookie is already gone. The endpoint URL is an unguessable secret
// the caller's own browser holds, and the only effect is stopping pushes.
export async function unsubscribe(req, res, next) {
  try {
    const parsed = unsubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid push subscription.' });
    }
    await PushSubscription.deleteOne({ endpoint: parsed.data.endpoint });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
