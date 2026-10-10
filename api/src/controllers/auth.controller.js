import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/config.js';
import { User } from '../models/User.js';
import { loginSchema } from '../validation/auth.schema.js';
import {
  ATTENDANCE_STANDARD_HOURS,
  isAttendanceExemptRole,
  isLateLogin,
  istDayKey,
} from '../config/attendance.js';
import { AttendanceDay } from '../models/AttendanceDay.js';
import { recordLogin } from './attendance.controller.js';

const INVALID_MSG =
  "That email and password don't match our records. Try again.";

function cookieOptions() {
  const isProd = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    employee: user.employee?._id?.toString?.() ?? user.employee?.toString?.() ?? null,
  };
}

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid request body.' });
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: INVALID_MSG });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: INVALID_MSG });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );

    res.cookie(config.cookieName, token, cookieOptions());
    const attendance = await recordLogin(user._id, user.role, new Date());
    return res.status(200).json({ user: toPublicUser(user), attendance });
  } catch (err) {
    return next(err);
  }
}

const logoutSchema = z
  .object({
    lateReason: z.string().trim().optional(),
    earlyLogoutReason: z.string().trim().optional(),
  })
  .catchall(z.unknown());

export async function logout(req, res, next) {
  try {
    // Best-effort attendance bookkeeping: identify the caller from the
    // cookie without requiring auth, so expired sessions still sign out.
    let payload = null;
    try {
      const token = req.cookies?.[config.cookieName];
      if (token) payload = jwt.verify(token, config.jwtSecret);
    } catch {
      payload = null;
    }
    if (payload?.sub) {
      const user = await User.findById(payload.sub);
      if (user && !isAttendanceExemptRole(user.role) && user.employee) {
        const parsed = logoutSchema.safeParse(req.body ?? {});
        const body = parsed.success ? parsed.data : {};
        const dayKey = istDayKey(new Date());
        const doc = await AttendanceDay.findOne({
          employee: user.employee,
          date: dayKey,
        });
        if (doc?.loginAt && doc.workingDay) {
          const now = new Date();
          const loginMs = new Date(doc.loginAt).getTime();
          // Late-login reason missing and not supplied: hold the session
          // open (don't clear the cookie) until a reason is given.
          if (
            !doc.lateReason?.trim() &&
            doc.workingDay &&
            isLateLogin(new Date(doc.loginAt))
          ) {
            const reason = body.lateReason?.trim?.() ?? '';
            if (!reason) {
              return res.status(400).json({
                message: 'A reason is required for signing in after 9:45.',
                code: 'LATE_REASON_REQUIRED',
              });
            }
            doc.lateReason = reason;
            doc.decidedBy = user._id;
            doc.decidedAt = now;
          }
          const durationHrs = (now.getTime() - loginMs) / 3600000;
          if (
            durationHrs < ATTENDANCE_STANDARD_HOURS &&
            !doc.earlyLogoutReason?.trim()
          ) {
            const reason = body.earlyLogoutReason?.trim?.() ?? '';
            if (!reason) {
              await doc.save().catch(() => {});
              return res.status(400).json({
                message: `A reason is required for signing out before ${ATTENDANCE_STANDARD_HOURS} hours.`,
                code: 'EARLY_LOGOUT_REASON_REQUIRED',
                durationHours: Math.round(durationHrs * 10) / 10,
              });
            }
            doc.earlyLogoutReason = reason;
            doc.decidedBy = user._id;
            doc.decidedAt = now;
          }
          doc.logoutAt = now;
          await doc.save().catch(() => {});
        } else if (doc && !doc.logoutAt) {
          doc.logoutAt = new Date();
          await doc.save().catch(() => {});
        }
      }
    }
    res.clearCookie(config.cookieName, cookieOptions());
    return res.status(200).json({ message: 'Signed out.' });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    return res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    return next(err);
  }
}
