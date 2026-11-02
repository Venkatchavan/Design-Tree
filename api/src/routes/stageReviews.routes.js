import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { denyRoles, requireInternal, requireRole } from '../middlewares/requireRole.js';
import { stageReviews } from '../controllers/stageReview.controller.js';

const router = Router();
router.use(requireAuth);
// Client PDF 28 October: explicit leadership log-only restriction before super-role bypass.
router.use((req,res,next)=>['GET','HEAD'].includes(req.method)?next():denyRoles('founding_director','working_director','executive_director')(req,res,next));

// Technical directors record cross-discipline stage reviews before client issue.
const REVIEW_WRITERS = [
  'design_mgmt_head',
  'technical_director',
  'associate_director',
  'executive_director',
];

router.get('/', requireInternal(), stageReviews.list);
router.get('/:id', requireInternal(), stageReviews.get);
router.post('/', requireRole(...REVIEW_WRITERS), stageReviews.create);
router.put('/:id', requireRole(...REVIEW_WRITERS), stageReviews.update);

export default router;
