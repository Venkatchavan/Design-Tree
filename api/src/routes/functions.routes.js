import { canReadProject } from '../utils/projectScope.js';
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  denyRoles,
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  addChecklistItem,
  addComment,
  approveWeeklyReport,
  areaSettlements,
  bimWorkOrders,
  boqItems,
  conveyances,
  createRfi,
  discrepancies,
  getGbsCert,
  peerReviews,
  rfis,
  saveGbsSteps,
  setPeerFinal,
  siteVisits,
  updateChecklistItem,
  updateComment,
  weeklyReports,
} from '../controllers/functions.controller.js';

const router = Router();
router.use(requireAuth);
router.use(async (req,res,next) => {
  try {
    if (req.body?.project && !await canReadProject(req.user,req.body.project)) return res.status(403).json({message:'Project is not assigned to you.'});
    return next();
  }catch(err){return next(err);}
});

// QS area settlement (QS-owned, no head review)
router.get('/area-settlements', requireInternal(), areaSettlements.list);
router.post('/area-settlements', requireRole('qs'), areaSettlements.create);
router.put('/area-settlements/:id', requireRole('qs'), areaSettlements.update);

// QS/BOQ line items (QS-owned Draft → Submitted → Approved, no head review)
router.get('/boq', requireInternal(), boqItems.list);
router.post('/boq', requireRole('qs'), boqItems.create);
router.put('/boq/:id', requireRole('qs'), boqItems.update);

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
router.post('/rfis', requireInternal(), denyRoles('coordinator'), createRfi);
router.put('/rfis/:id', requireInternal(), denyRoles('coordinator'), rfis.update);

// QA/QC weekly reports (team submits, Specs Head approves)
router.get('/weekly-reports', requireInternal(), weeklyReports.list);
router.get('/weekly-reports/:id', requireInternal(), weeklyReports.get);
router.post('/weekly-reports', requireRole('qaqc', 'qaqc_head'), weeklyReports.create);
router.patch('/weekly-reports/:id/approve', requireRole('qaqc_head'), approveWeeklyReport);

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
