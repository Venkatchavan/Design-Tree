import { stageTimeline } from '../controllers/stageTimeline.controller.js';
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireRole,
  requireView,
} from '../middlewares/requireRole.js';
import {
  claims,
  commercialOverview,
  createClaim,
  createPayment,
  financeOverview,
  payments,
  projectCosts,
  quotedFees,
  revenueByProject,
  setClaimStatus,
  setQuote,
  stages,
  upsertStage,
  updateStage,
  updateClaim,
} from '../controllers/billing.controller.js';

const router = Router();
router.use(requireAuth);
router.use((req, res, next) => ['founding_director', 'working_director', 'executive_director'].includes(req.user.role) && req.method !== 'GET' ? res.status(403).json({ message: 'Directors view billing and approval results only.' }) : next());

const BILLING_WRITERS = ['admin_billing', 'executive_director'];
// Stage completion progresses PTL → SPOC → TD/ATD before Admin can bill.
// TD + ATD share director approval from the individual project view.
const STAGE_WRITERS = [
  'admin_billing',
  'executive_director',
  'coordinator',
  'design_mgmt_head',
  'team_lead',
  'technical_director',
  'assoc_technical_director',
];
// Finance reads claims/stages live in Billing Status + Revenue (§4.15).
const BILLING_READERS = [
  'admin_billing',
  'executive_director',
  'finance',
];

// Claims
router.get('/claims', requireRole(...BILLING_READERS), claims.list);
router.get('/claims/:id', requireRole(...BILLING_READERS), claims.get);
router.post('/claims', requireRole(...BILLING_WRITERS), createClaim);
router.put('/claims/:id', requireRole(...BILLING_WRITERS), updateClaim);
router.patch(
  '/claims/:id/status',
  requireRole(...BILLING_WRITERS),
  setClaimStatus,
);

// Stage tracker + billing readiness (also powers Billing Status live).
// Associate/Technical/Associate-TD Directors + DMH/SPOC/PTL read the tracker.
router.get('/stage-timeline', requireView('stage-timeline'), stageTimeline);
router.get('/stages', requireRole(...BILLING_READERS, 'associate_director', 'technical_director', 'assoc_technical_director', 'design_mgmt_head', 'coordinator', 'team_lead', 'engineer_drafter', 'qs', 'qaqc', 'bim', 'gbs', 'peer_reviewer'), stages.list);
router.post('/stages', requireRole(...STAGE_WRITERS), upsertStage);
router.put('/stages/:id', requireRole(...STAGE_WRITERS), updateStage);

// Quoted fee (Billing view only).
router.get('/quoted-fees', requireView('billing'), quotedFees);
router.patch(
  '/projects/:id/quote',
  requireView('billing'),
  requireRole(...BILLING_WRITERS),
  setQuote,
);

// Payments (recorded by billing + finance).
router.get('/payments', requireRole(...BILLING_READERS), payments.list);
router.post(
  '/payments',
  requireRole(...BILLING_WRITERS, 'finance'),
  createPayment,
);

// Aggregates
router.get('/overview', requireRole(...BILLING_READERS), commercialOverview);
router.get(
  '/finance-overview',
  requireRole(...BILLING_READERS, 'finance'),
  financeOverview,
);
router.get(
  '/revenue-by-project',
  requireRole(...BILLING_READERS, 'finance'),
  revenueByProject,
);
router.get(
  '/project-costs',
  requireRole(...BILLING_READERS, 'finance'),
  projectCosts,
);

export default router;
