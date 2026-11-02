import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { INTERNAL_ROLES, DIRECTOR_ROLES } from '../config/roles.js';
import {
  bookingSummary,
  bookings,
  createBooking,
  rescheduleBooking,
  cancelBooking,
} from '../controllers/bookings.controller.js';
const router = Router();
router.use(requireAuth);
router.use((req, res, next) =>
  INTERNAL_ROLES.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: 'Internal travel bookings only.' }),
);
const writer = (req, res, next) =>
  DIRECTOR_ROLES.includes(req.user.role)
    ? res.status(403).json({
        message: 'Directors have read-only access to travel bookings.',
      })
    : next();
router.get('/summary', bookingSummary);
router.get('/', bookings.list);
router.get('/:id', bookings.get);
router.post('/', writer, createBooking);
router.put('/:id', writer, bookings.update);
router.post('/:id/reschedule', writer, rescheduleBooking);
router.post('/:id/cancel', writer, cancelBooking);
router.patch('/:id/status', writer, (_req, res) =>
  res
    .status(405)
    .json({ message: 'Use the reschedule or cancellation workflow.' }),
);
router.delete('/:id', writer, (_req, res) =>
  res
    .status(405)
    .json({ message: 'Bookings cannot be deleted. Cancel this trip instead.' }),
);
export default router;
