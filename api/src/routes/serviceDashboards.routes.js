import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import {
  listServiceDashboards,
  saveServiceDashboard,
} from '../controllers/serviceDashboard.controller.js';

const router = Router();
router.use(requireAuth);

// BIM / GBS leads and technical directors maintain their team and status figures.
const DASHBOARD_WRITERS = [
  'bim',
  'bim_head',
  'gbs',
  'gbs_head',
  'team_lead',
  'qs',
  'qs_head',
  'qaqc',
  'qaqc_head',
  'technical_director',
  'executive_director',
];

router.get('/', requireInternal(), listServiceDashboards);
router.put('/', requireRole(...DASHBOARD_WRITERS), saveServiceDashboard);

export default router;
