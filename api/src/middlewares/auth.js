import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
}
