import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireView } from '../middlewares/requireRole.js';
import { canAccess } from '../config/roles.js';
import {
  departmentOverview,
  managementOverview,
} from '../controllers/reports.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/management', requireView('management'), managementOverview);
// Board-only discipline dashboards (§3.3) — enforced per service for
// company-wide views. Project-scoped fetches (?project=<id>) back the
// per-project Departments tab, so any role that may open a project
// (dashboard / project-detail access) may fetch them.
router.get('/departments/:service', (req, res, next) => {
  const view = String(req.params.service ?? '').toLowerCase();
  if (!canAccess(req.user?.role, view)) {
    const scoped = req.query?.project;
    if (!scoped || !canAccess(req.user?.role, 'dashboard')) {
      return res
        .status(403)
        .json({ message: 'You do not have access to this area.' });
    }
  }
  return departmentOverview(req, res, next);
});

export default router;
