// Outgoing email (13 Nov 2026): RFI responses and revision notifications.
// Optional, like Web Push: with SMTP_HOST unset nothing is sent and the
// caller records the mail as "queued (SMTP not configured)" in its log, so
// the workflow never fails because mail is unavailable.
import { config } from '../config/config.js';

let transportPromise = null;

export function mailEnabled() {
  return Boolean(config.smtpHost);
}

async function transport() {
  if (!mailEnabled()) return null;
  transportPromise ??= import('nodemailer').then(({ default: nodemailer }) =>
    nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    }),
  );
  return transportPromise;
}

const clean = (list) => [...new Set((list ?? []).map((v) => String(v ?? '').trim().toLowerCase()).filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))];

// Returns { sent, to, cc, error? }. Never throws.
export async function sendMail({ to, cc = [], subject, text }) {
  const toList = clean(to);
  const ccList = clean(cc).filter((v) => !toList.includes(v));
  if (!toList.length) return { sent: false, to: toList, cc: ccList, error: 'No recipient email on file' };
  try {
    const t = await transport();
    if (!t) return { sent: false, to: toList, cc: ccList, error: 'SMTP not configured' };
    await t.sendMail({ from: config.mailFrom || config.smtpUser, to: toList.join(', '), cc: ccList.join(', ') || undefined, subject, text });
    return { sent: true, to: toList, cc: ccList };
  } catch (err) {
    return { sent: false, to: toList, cc: ccList, error: err?.message ?? 'Send failed' };
  }
}

// One-line log entry for a send result.
export function mailLogLine(result, what) {
  const who = [...result.to, ...result.cc.map((c) => `cc ${c}`)].join(', ') || 'no recipient';
  return result.sent
    ? `Email sent — ${what} → ${who}`
    : `Email queued, not sent (${result.error}) — ${what} → ${who}`;
}
