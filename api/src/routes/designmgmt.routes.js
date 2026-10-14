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
// Design Management Head and Technical Director update steps (additive: DMH keeps access).
router.put('/', requireRole('design_mgmt_head', 'technical_director'), saveWorkflow);

export default router;
