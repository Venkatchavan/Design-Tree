import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal } from '../middlewares/requireRole.js';
import * as c from '../controllers/dtPeerReview.controller.js';

// DT Peer Review (07 Nov 2026). Access is decided per request in the controller
// (dtPrAccess): Admin allots, the allotted review team writes, Srinivasa Rao and
// the Founding Directors read only, everyone else is refused. Directors never write.
const router = Router();
router.use(requireAuth, requireInternal());

router.get('/meta', c.meta);
router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', c.create);
router.put('/:id/team', c.setTeam);
router.patch('/:id', c.updateHeader);
router.post('/:id/checklist', c.addChecklistItem);
router.patch('/:id/checklist/:itemId', c.updateChecklistItem);
router.patch('/:id/approvals/:itemId', c.updateApproval);
router.post('/:id/comments', c.addComment);
router.post('/:id/comments/:commentId/rounds', c.addRound);
router.post('/:id/stages/:code/sign-off', c.signOffStage);
router.post('/:id/release', c.release);

export default router;
