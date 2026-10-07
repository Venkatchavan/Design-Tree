import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createTicket,
  myTickets,
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
router.patch('/:id', requireRole('hr'), updateTicket);

export default router;
