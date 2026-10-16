import { z } from 'zod';
import {
  ATTENDANCE_LATE_CUTOFF,
  ATTENDANCE_STANDARD_HOURS,
  isAttendanceExemptRole,
  isLateLogin,
  istDayKey,
  istDayRangeUtc,
  istParts,
} from '../config/attendance.js';
import { AttendanceDay } from '../models/AttendanceDay.js';
import { Holiday } from '../models/Holiday.js';
import { User } from '../models/User.js';

const reasonSchema = z
  .object({
    lateReason: z.string().trim().optional(),
    earlyLogoutReason: z.string().trim().optional(),
  })
  .strict();

async function resolveEmployeeId(userId) {
  const me = await User.findById(userId);
  return me?.employee ?? null;
}

// Sunday or a published Holiday: no late-login reason required.
export async function isWorkingDay(dayKey) {
  const parts = istParts(new Date(`${dayKey}T12:00:00+05:30`));
  if (parts.weekday === 0) return false;
  const { start, end } = istDayRangeUtc(dayKey);
  const holiday = await Holiday.findOne({ date: { $gte: start, $lt: end } }).select('_id');
  return !holiday;
}

function durationHours(doc) {
  if (!doc?.loginAt || !doc?.logoutAt) return null;
  return (new Date(doc.logoutAt) - new Date(doc.loginAt)) / 3600000;
}

function needsLateReason(doc) {
  if (!doc?.workingDay) return false;
  if (!doc?.loginAt) return false;
  if (doc.lateReason?.trim()) return false;
  return isLateLogin(new Date(doc.loginAt));
}

function needsEarlyReason(doc) {
  if (!doc?.loginAt || !doc?.logoutAt) return false;
  if (doc.earlyLogoutReason?.trim()) return false;
  return durationHours(doc) < ATTENDANCE_STANDARD_HOURS;
}

// Best-effort: records first login of the IST day. Never throws — login
// must succeed even if attendance bookkeeping fails.
export async function recordLogin(userId, role, now = new Date()) {
  try {
    if (isAttendanceExemptRole(role)) return null;
    const employeeId = await resolveEmployeeId(userId);
    if (!employeeId) return null;
    const dayKey = istDayKey(now);
    const workingDay = await isWorkingDay(dayKey);
    const existing = await AttendanceDay.findOne({ employee: employeeId, date: dayKey });
    if (existing) {
      if (!existing.loginAt) {
        existing.loginAt = now;
        existing.workingDay = workingDay;
        await existing.save();
      }
      return {
        late: needsLateReason(existing),
        reasonGiven: !!existing.lateReason?.trim(),
        workingDay: existing.workingDay,
      };
    }
    const doc = await AttendanceDay.create({
      employee: employeeId,
      date: dayKey,
      loginAt: now,
      workingDay,
      decidedBy: userId,
    });
    return {
      late: needsLateReason(doc),
      reasonGiven: false,
      workingDay,
    };
  } catch {
    return null;
  }
}

// Today's attendance state for the sign-out gate.
export async function attendanceStatus(req, res, next) {
  try {
    if (isAttendanceExemptRole(req.user?.role)) {
      return res.status(200).json({ required: false, exempt: true });
    }
    const employeeId = await resolveEmployeeId(req.user.id);
    if (!employeeId) return res.status(200).json({ required: false, exempt: true });
    const dayKey = istDayKey(new Date());
    const doc = await AttendanceDay.findOne({ employee: employeeId, date: dayKey });
    if (!doc?.loginAt) return res.status(200).json({ required: false, noLogin: true });
    const dur = durationHours(doc) ?? (new Date() - new Date(doc.loginAt)) / 3600000;
    return res.status(200).json({
      required: true,
      late: needsLateReason(doc),
      underHours: dur < ATTENDANCE_STANDARD_HOURS,
      durationHours: Math.round(dur * 10) / 10,
      lateReason: doc.lateReason ?? null,
      earlyLogoutReason: doc.earlyLogoutReason ?? null,
      loginAt: doc.loginAt,
      workingDay: doc.workingDay,
      cutoff: ATTENDANCE_LATE_CUTOFF,
      standardHours: ATTENDANCE_STANDARD_HOURS,
    });
  } catch (err) {
    return next(err);
  }
}

// Save late / early-logout reasons (LoginPage modal + sign-out modal).
export async function saveReason(req, res, next) {
  const parsed = reasonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    if (isAttendanceExemptRole(req.user?.role)) {
      return res.status(200).json({ item: null, exempt: true });
    }
    const employeeId = await resolveEmployeeId(req.user.id);
    if (!employeeId) return res.status(400).json({ message: 'No linked employee record.' });
    const dayKey = istDayKey(new Date());
    const doc = await AttendanceDay.findOne({ employee: employeeId, date: dayKey });
    if (!doc?.loginAt) return res.status(400).json({ message: 'No sign-in recorded today.' });
    if (parsed.data.lateReason !== undefined && needsLateReason(doc)) {
      if (!parsed.data.lateReason.trim()) {
        return res.status(400).json({ message: 'A reason is required for signing in after 9:45.' });
      }
      doc.lateReason = parsed.data.lateReason.trim();
    } else if (parsed.data.lateReason !== undefined) {
      doc.lateReason = parsed.data.lateReason.trim() || doc.lateReason;
    }
    if (parsed.data.earlyLogoutReason !== undefined) {
      if (!parsed.data.earlyLogoutReason.trim()) {
        return res.status(400).json({ message: 'A reason is required for signing out before 8 hours.' });
      }
      doc.earlyLogoutReason = parsed.data.earlyLogoutReason.trim();
    }
    doc.decidedBy = req.user.id;
    doc.decidedAt = new Date();
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// HR visibility: recent sign-in / sign-out days with reasons.
export async function listAttendance(req, res, next) {
  try {
    const filter = {};
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.date) {
      filter.date = String(req.query.date).slice(0, 10);
    } else {
      if (req.query.from || req.query.to) {
        // Date keys compare lexicographically as YYYY-MM-DD.
        filter.date = {};
        if (req.query.from) filter.date.$gte = String(req.query.from).slice(0, 10);
        if (req.query.to) filter.date.$lte = String(req.query.to).slice(0, 10);
      }
    }
    const items = await AttendanceDay.find(filter)
      .populate('employee', 'firstName lastName empId designation department branch')
      .sort({ date: -1 })
      .limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}
