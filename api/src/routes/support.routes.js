import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createTicket,
  attachSalarySlip,
  myTickets,
  salarySlipUpload,
  tickets,
  updateTicket,
} from '../controllers/support.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/mine', requireInternal(), myTickets);
router.post('/', requireInternal(), createTicket);
// HR handles salary slips, complaints, suggestions, queries (§4.19).
router.get('/', requireRole('hr'), tickets.list);
router.get('/:id', requireRole('hr'), tickets.get);
router.post(
  '/:id/salary-slip',
  requireRole('hr'),
  (req, res, next) =>
    salarySlipUpload(req, res, (err) =>
      err ? next(err) : attachSalarySlip(req, res, next),
    ),
);
router.patch('/:id', requireRole('hr'), updateTicket);

export default router;
