import { z } from 'zod';
import {
  ATTENDANCE_LATE_CUTOFF,
  ATTENDANCE_STANDARD_HOURS,
  EXTRA_HOURS_THRESHOLD,
  isAttendanceExemptRole,
  isLateLogin,
  istDayKey,
  istDayRangeUtc,
  istParts,
} from '../config/attendance.js';
import { AttendanceDay } from '../models/AttendanceDay.js';
import { Holiday } from '../models/Holiday.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { isSuperRole } from '../config/roles.js';
import { employeeOwnership } from '../utils/directorTeams.js';

const reasonSchema = z
  .object({
    lateReason: z.string().trim().optional(),
    earlyLogoutReason: z.string().trim().optional(),
    extraHoursReason: z.string().trim().optional(),
  })
  .strict();

const extraHoursDecisionSchema = z
  .object({
    status: z.enum(['approved', 'declined']),
    reason: z.string().trim().max(1000).optional(),
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

// Working past the standard day: the session has run longer than the
// threshold and no reason is recorded yet (asked at sign-out).
export function needsExtraHoursReason(doc, at = new Date()) {
  if (!doc?.workingDay || !doc?.loginAt) return false;
  if (doc.extraHoursReason?.trim()) return false;
  return (at.getTime() - new Date(doc.loginAt).getTime()) / 3600000 > EXTRA_HOURS_THRESHOLD;
}

// Stores the reason and queues it for the reporting TL / PTL (or mapped
// director). Callers save the doc.
export function recordExtraHours(doc, reason, userId, at = new Date()) {
  const hrs = (at.getTime() - new Date(doc.loginAt).getTime()) / 3600000;
  doc.extraHoursReason = reason.trim();
  doc.extraHours = Math.round(Math.max(0, hrs - EXTRA_HOURS_THRESHOLD) * 10) / 10;
  doc.extraHoursStatus = 'pending';
  doc.extraHoursDecisionReason = null;
  doc.extraHoursDecidedBy = undefined;
  doc.extraHoursDecidedAt = undefined;
  doc.decidedBy = userId;
  doc.decidedAt = at;
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
      let changed = false;
      if (!existing.loginAt) {
        existing.loginAt = now;
        existing.workingDay = workingDay;
        changed = true;
      }
      if (existing.logoutAt) { existing.logoutAt = null; changed = true; }
      if (changed) await existing.save();
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
    // This endpoint describes an authenticated live session, not a prior closed interval.
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(doc.loginAt).getTime()) / 1000));
    const dur = elapsedSeconds / 3600;
    return res.status(200).json({
      required: true,
      late: needsLateReason(doc),
      underHours: doc.workingDay && dur < ATTENDANCE_STANDARD_HOURS,
      overHours: needsExtraHoursReason(doc),
      extraHoursReason: doc.extraHoursReason ?? null,
      extraHoursStatus: doc.extraHoursStatus ?? null,
      extraHoursThreshold: EXTRA_HOURS_THRESHOLD,
      durationHours: Math.round(dur * 10) / 10,
      elapsedSeconds,
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
    if (parsed.data.extraHoursReason !== undefined && needsExtraHoursReason(doc)) {
      if (!parsed.data.extraHoursReason.trim()) {
        return res.status(400).json({ message: `A reason is required for working beyond ${EXTRA_HOURS_THRESHOLD} hours.` });
      }
      recordExtraHours(doc, parsed.data.extraHoursReason, req.user.id);
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

// Who an approver may act for: the saved reporting chain (TL / PTL via
// reportingManager, AD / TD / ATD via director). FD / WD / ED see everyone so
// a request with no resolvable approver is never stranded.
async function extraHoursScope(user) {
  if (isSuperRole(user?.role)) return { all: true, ids: null };
  const [employees, users] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } })
      .select('firstName middleName lastName empId email director reportingManager teamViewOf headOfDepartments department status').lean(),
    User.find({}).select('name email employee').lean(),
  ]);
  const { own, active, reporting } = employeeOwnership(user, employees, users);
  if (!active.has(own)) return { all: false, ids: [] };
  return { all: false, ids: [...reporting].filter((id) => id !== own) };
}

// Extra-hours requests awaiting (or past) a decision for the caller's team.
export async function listExtraHours(req, res, next) {
  try {
    const scope = await extraHoursScope(req.user);
    const status = ['pending', 'approved', 'declined'].includes(req.query.status) ? req.query.status : null;
    const filter = status ? { extraHoursStatus: status } : { extraHoursStatus: { $ne: null } };
    if (!scope.all) filter.employee = { $in: scope.ids };
    const items = await AttendanceDay.find(filter)
      .populate('employee', 'firstName middleName lastName empId designation department branch')
      .populate('extraHoursDecidedBy', 'name')
      .sort({ date: -1 })
      .limit(200);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

// Approve or decline. Approving needs the approver's reason; declining may
// carry one. Only pending requests inside the caller's reporting chain.
export async function decideExtraHours(req, res, next) {
  const parsed = extraHoursDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid decision.' });
  const reason = parsed.data.reason?.trim() ?? '';
  if (parsed.data.status === 'approved' && !reason) {
    return res.status(400).json({ message: 'A reason is required to approve extra hours.' });
  }
  try {
    const scope = await extraHoursScope(req.user);
    const doc = await AttendanceDay.findById(req.params.id);
    const inScope = doc && (scope.all || scope.ids.includes(String(doc.employee)));
    if (!doc?.extraHoursStatus || !inScope) {
      return res.status(404).json({ message: 'Extra-hours request not found.' });
    }
    if (doc.extraHoursStatus !== 'pending') {
      return res.status(409).json({ message: `This request was already ${doc.extraHoursStatus}.` });
    }
    doc.extraHoursStatus = parsed.data.status;
    doc.extraHoursDecisionReason = reason || null;
    doc.extraHoursDecidedBy = req.user.id;
    doc.extraHoursDecidedAt = new Date();
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
