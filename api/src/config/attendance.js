// Attendance policy: late login + early logout + extra hours reasons.
// Single source of truth — served to the client via GET /api/meta/bootstrap
// (`policy.attendance`) so web mirrors the same thresholds.
import { MAN_HOUR_EXEMPT_ROLES } from './roles.js';

export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata';
export const ATTENDANCE_LATE_CUTOFF = '09:45';
export const ATTENDANCE_LATE_CUTOFF_MINUTES = 9 * 60 + 45;
export const ATTENDANCE_STANDARD_HOURS = 8;
export const EXTRA_HOURS_THRESHOLD = 8;

// Same exempt set as the man-hour sign-out gate: directive roles +
// superuser + client/architect. Everyone else ("candidates") is covered.
export const ATTENDANCE_EXEMPT_ROLES = [...MAN_HOUR_EXEMPT_ROLES];

export function isAttendanceExemptRole(role) {
  return ATTENDANCE_EXEMPT_ROLES.includes(role);
}

// IST wall-clock parts for "now" without extra dependencies: shifting the
// epoch by +5:30 and reading UTC fields yields Asia/Kolkata wall time.
export function istParts(now = new Date()) {
  const shifted = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function istDayKey(now = new Date()) {
  const p = istParts(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// UTC range covering one IST calendar day (for Holiday overlap queries).
export function istDayRangeUtc(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function isLateLogin(now = new Date()) {
  return istParts(now).minutes > ATTENDANCE_LATE_CUTOFF_MINUTES;
}
