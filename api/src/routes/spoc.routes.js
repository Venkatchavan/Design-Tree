import { entryDocumentsUpload, attachEntryDocuments, downloadEntryDocument, spocDocumentAccess } from '../controllers/entryDocuments.controller.js';
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
router.get('/allocations/all', requireInternal(), listAllAllocations);
router.get('/allocations/mine', requireInternal(), myAllocations);
router.post(
  '/allocations/propose',
  requireRole('team_lead', 'assoc_technical_director', 'technical_director', 'coordinator', 'design_mgmt_head'),
  proposeAllocation,
);
router.post(
  '/allocations',
  requireRole('coordinator', 'design_mgmt_head', 'team_lead', 'technical_director'),
  recordAllocation,
);
router.patch(
  '/allocations/:id',
  requireRole('design_mgmt_head', 'admin_billing', 'technical_director'),
  setAllocationStatus,
);
router.post('/entries/:id/documents', spocDocumentAccess, entryDocumentsUpload, attachEntryDocuments);
router.get('/entries/:id/documents/:index', spocDocumentAccess, downloadEntryDocument);
router.get('/entries', requireInternal(), listSpocEntries);
router.post(
  '/entries',
  requireRole('coordinator', 'design_mgmt_head', 'technical_director'),
  createSpocEntry,
);
router.get('/man-hours/status', manHourStatus);

export default router;
