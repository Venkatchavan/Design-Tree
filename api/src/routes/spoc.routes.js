import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createSpocEntry,
  listSpocEntries,
  manHourStatus,
  myAllocations,
  recordAllocation,
} from '../controllers/spoc.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/allocations/mine', requireInternal(), myAllocations);
router.post(
  '/allocations',
  requireRole('coordinator', 'design_mgmt_head'),
  recordAllocation,
);
router.get('/entries', requireInternal(), listSpocEntries);
router.post(
  '/entries',
  requireRole('coordinator', 'design_mgmt_head'),
  createSpocEntry,
);
router.get('/man-hours/status', manHourStatus);

export default router;
