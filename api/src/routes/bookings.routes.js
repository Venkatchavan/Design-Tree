import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  INTERNAL_ROLES,
  TRAVEL_MANAGER_ROLES,
  TRAVEL_WRITER_ROLES,
} from '../config/roles.js';
import { travellerScope } from '../utils/travelScope.js';
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
  INTERNAL_ROLES.includes(req.user.role) && req.user.role !== 'superuser'
    ? next()
    : res.status(403).json({ message: 'Internal travel bookings only.' }),
);
// HR, Founding Directors and Finance read the company log. Every other
// internal user reads only bookings saved against their own employee record.
router.use(async (req, res, next) => {
  try {
    if (TRAVEL_MANAGER_ROLES.includes(req.user.role)) {
      req.travelScope = null;
      return next();
    }
    const own = await travellerScope(req.user.id);
    if (!own.length)
      return res
        .status(403)
        .json({ message: 'Travel bookings are limited to HR, Founding Directors, Finance and the traveller.' });
    req.travelScope = own;
    return next();
  } catch (error) {
    return next(error);
  }
});
const writer = (req, res, next) =>
  TRAVEL_WRITER_ROLES.includes(req.user.role)
    ? next()
    : res.status(403).json({
        message: 'Only HR and Finance record travel bookings.',
      });
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
