import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { denyRoles, requireInternal, requireRole } from '../middlewares/requireRole.js';
import * as c from '../controllers/dtPeerReview.controller.js';

// DT Peer Review: internal logins read within their project scope; only the
// Peer Review team writes. Directors (incl. FD/WD/ED) are read-only.
const router = Router();
router.use(requireAuth, requireInternal());
const write = [denyRoles('founding_director', 'working_director', 'executive_director'), requireRole('peer_reviewer', 'peer_review_head')];

router.get('/meta', c.meta);
router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', ...write, c.create);
router.patch('/:id', ...write, c.updateHeader);
router.post('/:id/checklist', ...write, c.addChecklistItem);
router.patch('/:id/checklist/:itemId', ...write, c.updateChecklistItem);
router.patch('/:id/approvals/:itemId', ...write, c.updateApproval);
router.post('/:id/comments', ...write, c.addComment);
router.post('/:id/comments/:commentId/rounds', ...write, c.addRound);
router.post('/:id/stages/:code/sign-off', ...write, c.signOffStage);
router.post('/:id/release', ...write, c.release);

export default router;
