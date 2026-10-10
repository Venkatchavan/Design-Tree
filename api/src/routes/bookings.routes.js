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
  deleteBooking,
  setBookingStatus,
} from '../controllers/bookings.controller.js';

const router = Router();
router.use(requireAuth);

// Directors manage bookings alongside Finance.
const BOOKING_WRITERS = ['finance', 'executive_director'];

router.get('/summary', requireView('travel-booking'), bookingSummary);
router.get('/', requireView('travel-booking'), bookings.list);
router.get('/:id', requireView('travel-booking'), bookings.get);
router.post('/', requireRole(...BOOKING_WRITERS), createBooking);
router.put('/:id', requireRole(...BOOKING_WRITERS), bookings.update);
router.patch('/:id/status', requireRole(...BOOKING_WRITERS), setBookingStatus);
router.delete('/:id', requireRole(...BOOKING_WRITERS), deleteBooking);

export default router;
