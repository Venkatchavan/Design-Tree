import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  addChecklistItem,
  addComment,
  areaSettlements,
  bimWorkOrders,
  conveyances,
  createRfi,
  discrepancies,
  getGbsCert,
  peerReviews,
  reviewAreaSettlement,
  rfis,
  saveGbsSteps,
  setPeerFinal,
  siteVisits,
  updateChecklistItem,
  updateComment,
} from '../controllers/functions.controller.js';

const router = Router();
router.use(requireAuth);

// QS area settlement (QS logs, QS Head reviews)
router.get('/area-settlements', requireInternal(), areaSettlements.list);
router.post('/area-settlements', requireRole('qs'), areaSettlements.create);
router.patch(
  '/area-settlements/:id/review',
  requireRole('qs_head'),
  reviewAreaSettlement,
);

// QA/QC site visits + discrepancies + conveyance + RFIs
router.get('/site-visits', requireInternal(), siteVisits.list);
router.post('/site-visits', requireRole('qaqc'), siteVisits.create);
router.put(
  '/site-visits/:id',
  requireRole('qaqc_head', 'team_lead'),
  siteVisits.update,
);
router.get('/discrepancies', requireInternal(), discrepancies.list);
router.post(
  '/discrepancies',
  requireRole('qaqc', 'team_lead'),
  discrepancies.create,
);
router.put(
  '/discrepancies/:id',
  requireRole('qaqc', 'team_lead'),
  discrepancies.update,
);
router.get('/conveyance', requireInternal(), conveyances.list);
router.post('/conveyance', requireInternal(), conveyances.create);
router.get('/rfis', requireInternal(), rfis.list);
router.post('/rfis', requireInternal(), createRfi);
router.put('/rfis/:id', requireInternal(), rfis.update);

// BIM work orders
router.get('/bim-work-orders', requireInternal(), bimWorkOrders.list);
router.post(
  '/bim-work-orders',
  requireRole('bim', 'bim_head'),
  bimWorkOrders.create,
);
router.put(
  '/bim-work-orders/:id',
  requireRole('bim', 'bim_head'),
  bimWorkOrders.update,
);

// GBS certification workflow (one doc per project)
router.get('/gbs-cert', requireInternal(), getGbsCert);
router.put('/gbs-cert', requireRole('gbs', 'gbs_head'), saveGbsSteps);

// Peer review
const PEER = ['peer_reviewer', 'peer_review_head'];
router.get('/peer-reviews', requireInternal(), peerReviews.list);
router.get('/peer-reviews/:id', requireInternal(), peerReviews.get);
router.post('/peer-reviews', requireRole(...PEER), peerReviews.create);
router.put('/peer-reviews/:id', requireRole(...PEER), peerReviews.update);
router.post(
  '/peer-reviews/:id/checklist',
  requireRole(...PEER),
  addChecklistItem,
);
router.patch(
  '/peer-reviews/:id/checklist/:itemId',
  requireRole(...PEER),
  updateChecklistItem,
);
router.post('/peer-reviews/:id/comments', requireRole(...PEER), addComment);
router.patch(
  '/peer-reviews/:id/comments/:itemId',
  requireRole(...PEER),
  updateComment,
);
router.patch(
  '/peer-reviews/:id/final',
  requireRole('peer_review_head'),
  setPeerFinal,
);

export default router;
