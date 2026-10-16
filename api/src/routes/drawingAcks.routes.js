import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal } from '../middlewares/requireRole.js';
import { listDrawingAcks } from '../controllers/drawingAck.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireInternal(), listDrawingAcks);

export default router;
