import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import { variations } from '../controllers/variations.controller.js';

const router = Router();
router.use(requireAuth);

// Technical team records and moves variations through the workflow;
// directors approve, Admin/Billing picks up the billing steps.
const VARIATION_WRITERS = [
  'team_lead',
  'coordinator',
  'design_mgmt_head',
  'admin_billing',
  'executive_director',
  'technical_director',
  'associate_director',
];

router.get('/', requireInternal(), variations.list);
router.get('/:id', requireInternal(), variations.get);
router.post('/', requireRole(...VARIATION_WRITERS), variations.create);
router.put('/:id', requireRole(...VARIATION_WRITERS), variations.update);

export default router;
