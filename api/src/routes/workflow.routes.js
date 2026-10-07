import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
  requireUserAdmin,
} from '../middlewares/requireRole.js';
import {
  createDeliverable,
  createRecruitment,
  createRevision,
  myRevisions,
  deliverables,
  drawings,
  listDeliverableLog,
  myTasks,
  recruitments,
  revisions,
  setRecruitmentStatus,
  setRevisionStatus,
  setTaskStatus,
  tasks,
} from '../controllers/workflow.controller.js';

const router = Router();
router.use(requireAuth);

const TL_CHAIN = [
  'team_lead',
  'assoc_technical_director',
  'technical_director',
];

// Tasks
router.get('/tasks/mine', requireInternal(), myTasks);
router.get('/tasks', requireInternal(), tasks.list);
router.get('/tasks/:id', requireInternal(), tasks.get);
router.post('/tasks', requireRole(...TL_CHAIN), tasks.create);
router.put('/tasks/:id', requireRole(...TL_CHAIN), tasks.update);
router.patch('/tasks/:id/status', requireInternal(), setTaskStatus);

// Deliverables (+log)
router.get('/deliverables', requireInternal(), deliverables.list);
router.get('/deliverables/:id', requireInternal(), deliverables.get);
router.post('/deliverables', requireRole(...TL_CHAIN), createDeliverable);
router.put(
  '/deliverables/:id',
  requireRole(...TL_CHAIN),
  deliverables.update,
);
router.get('/deliverables-log', requireInternal(), listDeliverableLog);

// Revisions
router.get('/revisions/mine', requireInternal(), myRevisions);
router.get('/revisions', requireInternal(), revisions.list);
router.get('/revisions/:id', requireInternal(), revisions.get);
router.post(
  '/revisions',
  requireRole(...TL_CHAIN, 'qaqc', 'peer_reviewer'),
  createRevision,
);
router.put('/revisions/:id', requireRole(...TL_CHAIN), revisions.update);
router.patch(
  '/revisions/:id/status',
  requireRole(...TL_CHAIN),
  setRevisionStatus,
);

// Drawing register
router.get('/drawings', requireInternal(), drawings.list);
router.get('/drawings/:id', requireInternal(), drawings.get);
router.post(
  '/drawings',
  requireRole(...TL_CHAIN, 'engineer_drafter'),
  drawings.create,
);
router.put('/drawings/:id', requireRole(...TL_CHAIN), drawings.update);

// Recruitment
router.get('/recruitment', requireInternal(), recruitments.list);
router.get('/recruitment/:id', requireInternal(), recruitments.get);
router.post('/recruitment', requireInternal(), createRecruitment);
router.put('/recruitment/:id', requireInternal(), recruitments.update);
router.patch(
  '/recruitment/:id/status',
  requireUserAdmin(),
  setRecruitmentStatus,
);

export default router;
