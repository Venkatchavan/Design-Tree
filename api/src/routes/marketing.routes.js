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
// Directors view the portfolio, briefs and contacts alongside Marketing.
const MARKETING_READERS = [...MARKETING, 'executive_director'];

router.get('/portfolio', requireRole(...MARKETING_READERS), portfolio);
router.get('/brief', requireRole(...MARKETING_READERS), getBrief);
router.put('/brief', requireRole('marketing'), saveBrief);
router.get('/collateral', requireInternal(), collateral.list);
router.post('/collateral', requireInternal(), createCollateral);
router.put('/collateral/:id', requireRole('marketing'), collateral.update);
router.get('/contacts/summary', requireRole(...MARKETING_READERS), contactSummary);
router.get('/contacts', requireRole(...MARKETING_READERS, 'admin_billing'), contacts.list);
router.post('/contacts', requireRole('marketing', 'executive_director', 'admin_billing'), createContact);

export default router;
