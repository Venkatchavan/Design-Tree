import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User } from '../models/User.js';
import { loginSchema } from '../validation/auth.schema.js';

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
    return res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function logout(_req, res, next) {
  try {
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
