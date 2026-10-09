import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireUserAdmin,
} from '../middlewares/requireRole.js';
import {
  branchOptions,
  createBranch,
  listBranches,
  updateBranch,
} from '../controllers/branches.controller.js';

const router = Router();

router.use(requireAuth);
// Strict dropdown source for every branch input.
router.get('/options', requireInternal(), branchOptions);
router.get('/', requireInternal(), listBranches);
router.post('/', requireUserAdmin(), createBranch);
router.put('/:id', requireUserAdmin(), updateBranch);

export default router;
