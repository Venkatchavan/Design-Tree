import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  absenceLog,
  addAction,
  cancelMeeting,
  createMeeting,
  getMeeting,
  listMeetings,
  markHeld,
  rescheduleMeeting,
  respondInvite,
  saveAttendance,
  saveMom,
  setActionStatus,
  updateMeeting,
} from '../controllers/meetings.controller.js';

const router = Router();
router.use(requireAuth);

const SCHEDULERS = ['coordinator', 'design_mgmt_head'];

router.get('/', requireInternal(), listMeetings);
router.get('/absence-log', requireInternal(), absenceLog);
router.get('/:id', requireInternal(), getMeeting);
router.post('/', requireRole(...SCHEDULERS), createMeeting);
router.put('/:id', requireRole(...SCHEDULERS), updateMeeting);
router.patch('/:id/reschedule', requireRole(...SCHEDULERS), rescheduleMeeting);
router.patch('/:id/held', requireRole(...SCHEDULERS), markHeld);
router.patch('/:id/cancel', requireRole(...SCHEDULERS), cancelMeeting);
router.put('/:id/attendance', requireRole(...SCHEDULERS), saveAttendance);
router.put('/:id/mom', requireRole(...SCHEDULERS), saveMom);
router.post('/:id/actions', requireRole(...SCHEDULERS), addAction);
// Action owners flip their own items (checked inside); superusers bypass.
router.patch('/:id/actions/:actionId', requireInternal(), setActionStatus);
// Invited employees respond (checked inside).
router.post('/:id/respond', requireInternal(), respondInvite);

export default router;
