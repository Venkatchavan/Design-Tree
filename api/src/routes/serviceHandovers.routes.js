import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import { acknowledgeHandover, createHandover, listHandovers } from '../controllers/serviceHandover.controller.js';

// 17 Nov 2026: SPOC service handover / intimation.
const router = Router();
router.use(requireAuth);
router.get('/', requireInternal(), listHandovers);
router.post('/', requireRole('coordinator'), createHandover);
router.patch('/:id/acknowledge', requireInternal(), acknowledgeHandover);

export default router;
