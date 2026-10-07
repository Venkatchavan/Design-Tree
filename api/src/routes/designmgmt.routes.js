import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  getWorkflow,
  saveWorkflow,
  workflowMeta,
} from '../controllers/designmgmt.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/meta', requireInternal(), workflowMeta);
router.get('/', requireInternal(), getWorkflow);
// Only the Design Management Head (or superusers) updates steps (§4.11).
router.put('/', requireRole('design_mgmt_head'), saveWorkflow);

export default router;
