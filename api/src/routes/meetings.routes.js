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
  downloadMom,
  getMeeting,
  listMeetings,
  markHeld,
  meetingFilesUpload,
  rescheduleMeeting,
  respondInvite,
  saveAttendance,
  saveMom,
  setActionNote,
  setActionStatus,
  updateMeeting,
  uploadRefDocs,
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
router.post(
  '/:id/refdocs',
  requireRole(...SCHEDULERS),
  (req, res, next) =>
    meetingFilesUpload(req, res, (err) =>
      err ? next(err) : uploadRefDocs(req, res, next),
    ),
);
router.get('/:id/mom/download', requireInternal(), downloadMom);
router.post('/:id/actions', requireRole(...SCHEDULERS), addAction);
// Action owners flip their own items (checked inside); superusers bypass.
router.patch('/:id/actions/:actionId', requireInternal(), setActionStatus);
router.patch('/:id/actions/:actionId/note', requireInternal(), setActionNote);
// Invited employees respond (checked inside).
router.post('/:id/respond', requireInternal(), respondInvite);

export default router;
