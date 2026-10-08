import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createSpocEntry,
  listAllocations,
  listSpocEntries,
  manHourStatus,
  myAllocations,
  proposeAllocation,
  recordAllocation,
  setAllocationStatus,
} from '../controllers/spoc.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/allocations', requireInternal(), listAllocations);
router.get('/allocations/mine', requireInternal(), myAllocations);
router.post(
  '/allocations/propose',
  requireRole('team_lead', 'assoc_technical_director', 'technical_director', 'coordinator', 'design_mgmt_head'),
  proposeAllocation,
);
router.post(
  '/allocations',
  requireRole('coordinator', 'design_mgmt_head'),
  recordAllocation,
);
router.patch(
  '/allocations/:id',
  requireRole('design_mgmt_head', 'admin_billing'),
  setAllocationStatus,
);
router.get('/entries', requireInternal(), listSpocEntries);
router.post(
  '/entries',
  requireRole('coordinator', 'design_mgmt_head'),
  createSpocEntry,
);
router.get('/man-hours/status', manHourStatus);

export default router;
