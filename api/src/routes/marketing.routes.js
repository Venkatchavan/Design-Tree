import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  collateral,
  contactSummary,
  contacts,
  createCollateral,
  createContact,
  getBrief,
  portfolio,
  saveBrief,
} from '../controllers/marketing.controller.js';

const router = Router();
router.use(requireAuth);

const MARKETING = ['marketing', 'founding_director', 'working_director'];

router.get('/portfolio', requireRole(...MARKETING), portfolio);
router.get('/brief', requireRole(...MARKETING), getBrief);
router.put('/brief', requireRole('marketing'), saveBrief);
router.get('/collateral', requireInternal(), collateral.list);
router.post('/collateral', requireInternal(), createCollateral);
router.put('/collateral/:id', requireRole('marketing'), collateral.update);
router.get('/contacts/summary', requireRole(...MARKETING), contactSummary);
router.get('/contacts', requireRole(...MARKETING), contacts.list);
router.post('/contacts', requireRole('marketing'), createContact);

export default router;
