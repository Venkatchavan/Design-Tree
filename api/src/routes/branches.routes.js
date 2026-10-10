import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal } from '../middlewares/requireRole.js';
import {
  branchOptions,
  createBranch,
  listBranches,
  updateBranch,
} from '../controllers/branches.controller.js';

const router = Router();

// Strictly Admin-only write access: unlike requireRole('admin_billing'),
// this does NOT grant the FD/WD superuser bypass.
const requireAdminStrict = (req, res, next) =>
  req.user?.role === 'admin_billing'
    ? next()
    : res.status(403).json({ message: 'You do not have access to this area.' });

router.use(requireAuth);
// Strict dropdown source for every branch input.
router.get('/options', requireInternal(), branchOptions);
router.get('/', requireInternal(), listBranches);
router.post('/', requireAdminStrict, createBranch);
router.put('/:id', requireAdminStrict, updateBranch);

export default router;
