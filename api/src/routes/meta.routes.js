import { Router } from 'express';
import {
  ROLES,
  VIEWS,
  homeView,
  navFor,
  roleLabel,
} from '../config/roles.js';
import { requireAuth } from '../middlewares/auth.js';

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
  });
});

export default router;
