import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  markAllRead,
  markRead,
  myNotifications,
} from '../controllers/notifications.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', myNotifications);
router.patch('/:id/read', markRead);
router.post('/read-all', markAllRead);

export default router;
