import { API_BASE, request } from './api.js';

// Web Push opt-in (alerts when the app is closed). The in-app bell keeps
// working with or without this; push is purely additive.

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function isIos() {
  const ua = navigator.userAgent ?? '';
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS reports as Mac but has touch.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true
  );
}

// 'unsupported' | 'needs-install' (iOS, not on Home Screen) | 'blocked' |
// 'off' | 'on'
export async function getPushState() {
  if (!isPushSupported()) {
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function fetchPushConfig() {
  return request('/api/push/public-key');
}

async function sendSubscription(sub) {
  return request('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(sub.toJSON()),
  });
}

// Must be called from a user gesture (iOS/Safari require it).
export async function enablePush() {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications.');
  const cfg = await fetchPushConfig();
  if (!cfg.enabled || !cfg.publicKey) {
    throw new Error('Push notifications are not enabled on the server.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Allow them in your browser site settings.'
        : 'Notification permission was not granted.',
    );
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    });
  }
  await sendSubscription(sub);
}

export async function disablePush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await forgetEndpoint(sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}

// Re-assert the stored subscription for whoever is signed in now. Covers a
// shared browser where the previous session expired without a clean sign-out.
export async function syncPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sendSubscription(sub);
}

// Unauthenticated on purpose (runs after the session cookie is gone).
function forgetEndpoint(endpoint) {
  return fetch(`${API_BASE}/api/push/unsubscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

// On sign-out: stop this device receiving the previous user's alerts. The
// next user opts in again from the bell.
export async function forgetPushOnLogout() {
  try {
    if (!isPushSupported()) return;
    await disablePush();
  } catch {
    /* sign-out must never fail because of push cleanup */
  }
}
