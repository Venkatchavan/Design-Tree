import { Router } from 'express';
import {
  ATTENDANCE_LATE_CUTOFF,
  ATTENDANCE_STANDARD_HOURS,
  ATTENDANCE_TIMEZONE,
  EXTRA_HOURS_THRESHOLD,
  isAttendanceExemptRole,
} from '../config/attendance.js';
import {
  ROLES,
  VIEWS,
  homeView,
  navFor,
  roleLabel,
} from '../config/roles.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = Router();

// Single source of truth for roles/nav/views — the client builds its
// sidebar and route guards from this instead of duplicating the registry.
router.get('/bootstrap', requireAuth, (req, res) => {
  const role = req.user.role;
  res.status(200).json({
    roles: ROLES,
    views: VIEWS,
    role: { key: role, label: roleLabel(role) },
    home: homeView(role),
    nav: navFor(role),
    policy: {
      attendance: {
        lateCutoff: ATTENDANCE_LATE_CUTOFF,
        standardHours: ATTENDANCE_STANDARD_HOURS,
        timezone: ATTENDANCE_TIMEZONE,
        extraHoursThreshold: EXTRA_HOURS_THRESHOLD,
        exempt: isAttendanceExemptRole(role),
      },
    },
  });
});

// OpenStreetMap Nominatim proxy for the New Project location search.
// Server-side keeps the required User-Agent header and shields the client
// from the upstream rate limits; admin-only like the New Project page.
router.get('/geocode', requireAuth, requireRole('admin_billing'), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 3) return res.status(200).json({ items: [] });
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let upstream;
    try {
      upstream = await fetch(url, {
        headers: { 'User-Agent': 'DesignTree/1.0', Accept: 'application/json' },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!upstream.ok) {
      return res.status(502).json({ message: 'Location search is unavailable right now.' });
    }
    const rows = await upstream.json().catch(() => []);
    const items = (Array.isArray(rows) ? rows : []).map((r) => {
      const a = r.address ?? {};
      const road = [a.house_number, a.road].filter(Boolean).join(' ');
      const suburb = a.suburb ?? a.neighbourhood ?? a.hamlet ?? '';
      const city = a.city ?? a.town ?? a.village ?? a.county ?? '';
      return {
        label: [suburb, city].filter(Boolean).join(', ') || String(r.display_name ?? '').split(',').slice(0, 2).join(','),
        address1: road,
        address2: suburb,
        city,
        state: a.state ?? '',
        zip: a.postcode ?? '',
      };
    });
    return res.status(200).json({ items });
  } catch (err) {
    return next(err);
  }
});

export default router;
