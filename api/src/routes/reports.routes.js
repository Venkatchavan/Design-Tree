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
// Board-only discipline dashboards (§3.3) — enforced per service.
router.get('/departments/:service', (req, res, next) => {
  const view = String(req.params.service ?? '').toLowerCase();
  if (!canAccess(req.user?.role, view)) {
    return res
      .status(403)
      .json({ message: 'You do not have access to this area.' });
  }
  return departmentOverview(req, res, next);
});

export default router;
