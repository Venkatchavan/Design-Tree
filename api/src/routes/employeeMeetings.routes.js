import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  createEmployeeMeeting,
  listEmployeeMeetings,
} from '../controllers/employeeMeetings.controller.js';

const router = Router();
router.use(requireAuth, requireRole('hr'));
router.get('/', listEmployeeMeetings);
router.post('/', createEmployeeMeeting);

export default router;
