import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { denyRoles, requireInternal, requireRole } from '../middlewares/requireRole.js';
import { workItems } from '../controllers/workItem.controller.js';

const router = Router();
router.use(requireAuth);
// Client PDF 28 October: explicit leadership log-only restriction before super-role bypass.
router.use((req,res,next)=>['GET','HEAD'].includes(req.method)?next():denyRoles('founding_director','working_director','executive_director')(req,res,next));

// QS team records work items; team lead and technical directors review them.
const WORK_ITEM_WRITERS = [
  'qs',
  'qs_head',
  'team_lead',
  'design_mgmt_head',
  'technical_director',
  'executive_director',
];

router.get('/', requireInternal(), workItems.list);
router.get('/:id', requireInternal(), workItems.get);
router.post('/', requireRole(...WORK_ITEM_WRITERS), workItems.create);
router.put('/:id', requireRole(...WORK_ITEM_WRITERS), workItems.update);

export default router;
