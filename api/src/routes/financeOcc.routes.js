import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
  requireView,
} from '../middlewares/requireRole.js';
import {
  createFinanceOcc,
  decideFinanceOcc,
  deleteFinanceOcc,
  financeOcc,
  financeOccSummary,
  myFinanceOcc,
  updateFinanceOcc,
} from '../controllers/financeOcc.controller.js';

const router = Router();
router.use(requireAuth);

// Reference: financeocc visible to director/working/exec/finance only (admin blocked).
router.get('/summary', requireView('finance-occ'), financeOccSummary);
router.get('/mine', requireInternal(), myFinanceOcc);
router.get('/', requireView('finance-occ'), financeOcc.list);
router.get('/:id', requireView('finance-occ'), financeOcc.get);
router.post('/', requireView('finance-occ'), createFinanceOcc);
router.put('/:id', requireView('finance-occ'), updateFinanceOcc);
// Finance-only decision (super FD/WD bypass via requireRole). Admin blocked per reference.
router.patch('/:id/decision', requireRole('finance'), decideFinanceOcc);
router.delete('/:id', requireRole('finance'), deleteFinanceOcc);

export default router;
