import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  attendanceStatus,
  decideExtraHours,
  listAttendance,
  listExtraHours,
  saveReason,
} from '../controllers/attendance.controller.js';

const router = Router();
router.use(requireAuth);

// Own sign-in / sign-out state + reason capture.
router.get('/status', attendanceStatus);
router.patch('/reason', saveReason);

// Extra hours (beyond 8h) approvals for the reporting TL / PTL / directors.
// Scoped to the caller's saved reporting chain inside the controller.
router.get('/extra-hours', listExtraHours);
router.patch('/extra-hours/:id', decideExtraHours);

// HR visibility into sign-in / sign-out days (FD/WD bypass via requireRole).
// Associate/Technical Directors read it for the Management HR tab (read-only).
router.get('/', requireRole('hr', 'admin_billing', 'executive_director', 'associate_director', 'technical_director'), listAttendance);

export default router;
