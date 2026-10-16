import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  attendanceStatus,
  listAttendance,
  saveReason,
} from '../controllers/attendance.controller.js';

const router = Router();
router.use(requireAuth);

// Own sign-in / sign-out state + reason capture.
router.get('/status', attendanceStatus);
router.patch('/reason', saveReason);

// HR visibility into sign-in / sign-out days (FD/WD bypass via requireRole).
// Associate/Technical Directors read it for the Management HR tab (read-only).
router.get('/', requireRole('hr', 'admin_billing', 'executive_director', 'associate_director', 'technical_director'), listAttendance);

export default router;
