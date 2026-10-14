import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireRole,
  requireView,
} from '../middlewares/requireRole.js';
import {
  getWorkflow,
  saveWorkflow,
  workflowMeta,
} from '../controllers/designmgmt.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/meta', requireView('design-mgmt'), workflowMeta);
router.get('/', requireView('design-mgmt'), getWorkflow);
// Design Management Head owns the workflow steps (TD/Assoc-TD have no design-mgmt access).
router.put('/', requireRole('design_mgmt_head'), saveWorkflow);

export default router;
