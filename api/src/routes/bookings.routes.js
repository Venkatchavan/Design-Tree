import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireRole,
  requireView,
} from '../middlewares/requireRole.js';
import {
  bookingSummary,
  bookings,
  createBooking,
  setBookingStatus,
} from '../controllers/bookings.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', requireView('travel-booking'), bookingSummary);
router.get('/', requireView('travel-booking'), bookings.list);
router.get('/:id', requireView('travel-booking'), bookings.get);
router.post('/', requireRole('finance'), createBooking);
router.put('/:id', requireRole('finance'), bookings.update);
router.patch('/:id/status', requireRole('finance'), setBookingStatus);

export default router;
