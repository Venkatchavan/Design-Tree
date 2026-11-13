import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  publicKey,
  subscribe,
  unsubscribe,
} from '../controllers/push.controller.js';

const router = Router();

router.get('/public-key', publicKey);
router.post('/unsubscribe', unsubscribe);
router.post('/subscribe', requireAuth, subscribe);

export default router;
