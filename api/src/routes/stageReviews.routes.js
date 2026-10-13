import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import { stageReviews } from '../controllers/stageReview.controller.js';

const router = Router();
router.use(requireAuth);

// Technical directors record cross-discipline stage reviews before client issue.
const REVIEW_WRITERS = [
  'design_mgmt_head',
  'technical_director',
  'assoc_technical_director',
  'associate_director',
  'executive_director',
];

router.get('/', requireInternal(), stageReviews.list);
router.get('/:id', requireInternal(), stageReviews.get);
router.post('/', requireRole(...REVIEW_WRITERS), stageReviews.create);
router.put('/:id', requireRole(...REVIEW_WRITERS), stageReviews.update);

export default router;
