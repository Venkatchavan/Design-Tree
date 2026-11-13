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
import { approverScope, approverUserIdsFor } from '../utils/approverScope.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';

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
// A reason is mandatory both when approving and when declining.
const decisionReasonMessage = (status) => `A reason is required to ${status === 'approved' ? 'approve' : 'decline'} extra hours.`;

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

// Extra hours: a working day that has run past the standard day, or ANY work on a
// Sunday / holiday (07 Nov 2026: Sunday work was never queued for approval).
// Asked at sign-out while no reason is recorded yet.
export function needsExtraHoursReason(doc, at = new Date()) {
  if (!doc?.loginAt) return false;
  if (doc.extraHoursReason?.trim()) return false;
  if (!doc.workingDay) return true;
  return (at.getTime() - new Date(doc.loginAt).getTime()) / 3600000 > EXTRA_HOURS_THRESHOLD;
}

// Hours to approve: beyond 8 on a working day, the whole session on a Sunday / holiday.
export function extraHoursFor(doc, at = new Date()) {
  const hrs = (at.getTime() - new Date(doc.loginAt).getTime()) / 3600000;
  const extra = doc.workingDay ? Math.max(0, hrs - EXTRA_HOURS_THRESHOLD) : Math.max(0, hrs);
  return Math.round(extra * 10) / 10;
}

// A pending request follows later sign-outs the same day so the TL approves the
// real total; a decided one is left as decided.
export function refreshExtraHours(doc, at = new Date()) {
  // A work-update request carries the logged hours; keep the larger figure.
  if (doc?.extraHoursStatus === 'pending' && doc.loginAt) {
    const session = extraHoursFor(doc, at);
    doc.extraHours = doc.extraHoursSource === 'work-update' ? Math.max(session, doc.extraHours ?? 0) : session;
  }
}

// Tell the TL / PTL / directors who must decide it. Best effort, after the doc is saved.
export async function notifyExtraHoursRequest(doc) {
  try {
    const employee = await Employee.findById(doc.employee).select('firstName lastName').lean();
    const who = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || 'A team member';
    await notify({
      users: await approverUserIdsFor(doc.employee, { designMgmtHead: true }),
      roles: ['founding_director', 'working_director', 'executive_director'],
      link: { view: 'my-team' },
      title: `${doc.workingDay ? 'Extra hours' : 'Sunday / holiday work'}: ${who}`,
      detail: `${doc.date} · ${doc.extraHours} h · ${String(doc.extraHoursReason ?? '').slice(0, 100)}`,
      type: 'extra-hours',
    });
  } catch { /* the request is saved; the bell is best effort */ }
}

// Stores the reason and queues it for the reporting TL / PTL (or mapped
// director). Callers save the doc.
export function recordExtraHours(doc, reason, userId, at = new Date()) {
  doc.extraHoursReason = reason.trim();
  doc.extraHours = extraHoursFor(doc, at);
  doc.extraHoursStatus = 'pending';
  doc.extraHoursSource = 'sign-out';
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
      // Sunday / holiday work is asked as extra hours for the whole session.
      sundayWork: !doc.workingDay,
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
    let requested = false;
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
      requested = true;
    }
    doc.decidedBy = req.user.id;
    doc.decidedAt = new Date();
    await doc.save();
    if (requested) await notifyExtraHoursRequest(doc);
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

// Roles that can see extra-hours requests but never decide them (view only).
const EXTRA_HOURS_VIEW_ONLY_ROLES = ['founding_director'];

// Extra-hours requests awaiting (or past) a decision for the caller's team.
export async function listExtraHours(req, res, next) {
  try {
    const scope = await approverScope(req.user);
    const status = ['pending', 'approved', 'declined'].includes(req.query.status) ? req.query.status : null;
    const filter = status ? { extraHoursStatus: status } : { extraHoursStatus: { $ne: null } };
    if (!scope.all) filter.employee = { $in: scope.ids };
    const items = await AttendanceDay.find(filter)
      .populate('employee', 'firstName middleName lastName empId designation department branch')
      .populate('extraHoursDecidedBy', 'name')
      .sort({ date: -1 })
      .limit(200);
    return res.status(200).json({
      items,
      total: items.length,
      canDecide: !EXTRA_HOURS_VIEW_ONLY_ROLES.includes(req.user.role),
    });
  } catch (err) {
    return next(err);
  }
}

// Approve or decline. Both need the approver's reason, which is recorded with who
// decided and when. Only pending requests inside the caller's scope.
export async function decideExtraHours(req, res, next) {
  if (EXTRA_HOURS_VIEW_ONLY_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Extra-hours requests are view only for your role.' });
  }
  const parsed = extraHoursDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid decision.' });
  const reason = parsed.data.reason?.trim() ?? '';
  if (!reason) return res.status(400).json({ message: decisionReasonMessage(parsed.data.status) });
  try {
    const scope = await approverScope(req.user);
    const doc = await AttendanceDay.findById(req.params.id);
    const inScope = doc && (scope.all || scope.ids.includes(String(doc.employee)));
    if (!doc?.extraHoursStatus || !inScope) {
      return res.status(404).json({ message: 'Extra-hours request not found.' });
    }
    if (doc.extraHoursStatus !== 'pending') {
      return res.status(409).json({ message: `This request was already ${doc.extraHoursStatus}.` });
    }
    doc.extraHoursStatus = parsed.data.status;
    doc.extraHoursDecisionReason = reason;
    doc.extraHoursDecidedBy = req.user.id;
    doc.extraHoursDecidedAt = new Date();
    await doc.save();
    try {
      const users = await userIdsForEmployees([doc.employee]);
      await notify({
        users,
        link: { view: 'my-work' },
        title: `Your ${doc.workingDay ? 'extra hours' : 'Sunday / holiday work'} on ${doc.date} ${parsed.data.status}`,
        detail: reason.slice(0, 140),
        type: 'extra-hours',
      });
    } catch { /* best effort */ }
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
