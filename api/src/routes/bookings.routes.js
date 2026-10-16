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
router.use((req, res, next) => req.user.role === 'finance' ? next() : res.status(403).json({ message: 'Travel bookings are managed by Finance.' }));

// Finance-only (FD/WD superusers bypass via requireRole).
const BOOKING_WRITERS = ['finance'];

router.get('/summary', requireView('travel-booking'), bookingSummary);
router.get('/', requireView('travel-booking'), bookings.list);
router.get('/:id', requireView('travel-booking'), bookings.get);
router.post('/', requireRole(...BOOKING_WRITERS), createBooking);
router.put('/:id', requireRole(...BOOKING_WRITERS), bookings.update);
router.patch('/:id/status', requireRole(...BOOKING_WRITERS), setBookingStatus);
router.delete('/:id', requireRole(...BOOKING_WRITERS), deleteBooking);

export default router;
