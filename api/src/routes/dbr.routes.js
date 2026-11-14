import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import { dbrFeedback, forwardDbr, listDbr, reviewDbr, shareDbr, submitDbr } from '../controllers/dbr.controller.js';

// 13 Nov 2026: DBR (Design Basis Report) workflow.
const router = Router();
router.use(requireAuth);
router.get('/', requireInternal(), listDbr);
router.post('/', requireRole('team_lead', 'assoc_technical_director', 'technical_director', 'engineer_drafter'), submitDbr);
router.patch('/:id/review', requireRole('team_lead', 'assoc_technical_director', 'technical_director'), reviewDbr);
router.post('/:id/forward', requireRole('team_lead', 'assoc_technical_director', 'technical_director'), forwardDbr);
router.post('/:id/share', requireRole('coordinator'), shareDbr);
router.patch('/:id/feedback', requireRole('coordinator'), dbrFeedback);

export default router;
