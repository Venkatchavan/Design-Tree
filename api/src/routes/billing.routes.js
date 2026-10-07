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
} from '../controllers/billing.controller.js';

const router = Router();
router.use(requireAuth);

const BILLING_WRITERS = ['admin_billing', 'executive_director'];
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
router.put('/claims/:id', requireRole(...BILLING_WRITERS), claims.update);
router.patch(
  '/claims/:id/status',
  requireRole(...BILLING_WRITERS),
  setClaimStatus,
);

// Stage tracker + billing readiness (also powers Billing Status live).
router.get('/stages', requireRole(...BILLING_READERS), stages.list);
router.post('/stages', requireRole(...BILLING_WRITERS), upsertStage);
router.put('/stages/:id', requireRole(...BILLING_WRITERS), stages.update);

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
