import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createWorkEntry,
  decideWorkEntry,
  listWorkEntries,
} from '../controllers/workEntries.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireInternal(), listWorkEntries);
router.post('/', requireInternal(), createWorkEntry);
router.patch(
  '/:id/decision',
  requireRole(
    'team_lead',
    'assoc_technical_director',
    'technical_director',
  ),
  decideWorkEntry,
);

export default router;
