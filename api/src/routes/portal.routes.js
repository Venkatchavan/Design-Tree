import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  acknowledge,
  acknowledgeStage,
  myPortal,
  respondRfi,
  setPortalUsers,
  uploadForRequest,
} from '../controllers/portal.controller.js';
import { uploadFile } from '../controllers/certificates.controller.js';

const router = Router();
router.use(requireAuth);

// External view — Client/Architect only (+ superusers preview).
router.get(
  '/mine',
  requireRole('client', 'architect'),
  myPortal,
);
router.post(
  '/acknowledge',
  requireRole('client', 'architect'),
  acknowledge,
);
router.post(
  '/rfis/:id/respond',
  requireRole('client', 'architect'),
  respondRfi,
);
router.post(
  '/stages/:id/acknowledge',
  requireRole('client', 'architect'),
  acknowledgeStage,
);
router.post(
  '/requests/:id/upload',
  requireRole('client', 'architect'),
  (req, res, next) =>
    uploadFile(req, res, (err) =>
      err ? next(err) : uploadForRequest(req, res, next),
    ),
);

// Portal project assignment (Admin/FD).
router.patch(
  '/projects/:id/users',
  requireRole('admin_billing'),
  setPortalUsers,
);

export default router;
