import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
  requireView,
} from '../middlewares/requireRole.js';
import {
  CREATOR_ROLES,
  activateProject,
  createProject,
  getProject,
  getProjectTeam,
  gfcReadiness,
  listProjects,
  projectFilters,
  projectStats,
  recordFinalApproval,
  saveTeamConfirmation,
  updateProject,
} from '../controllers/projects.controller.js';
import {
  getDirectory,
  saveDirectory,
} from '../controllers/directory.controller.js';
import {
  importProjects,
  uploadSpreadsheet,
} from '../controllers/projectImport.controller.js';
import { setPortalUsers } from '../controllers/portal.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireView('dashboard'), listProjects);
router.get('/stats', requireView('dashboard'), projectStats);
router.get('/filters', requireView('dashboard'), projectFilters);
router.get('/:id/team', requireAuth, getProjectTeam);
router.get('/:id/gfc-readiness', requireInternal(), gfcReadiness);
router.get('/:id/directory', requireAuth, getDirectory);
router.put(
  '/:id/directory',
  requireRole('coordinator', 'design_mgmt_head', 'admin_billing'),
  saveDirectory,
);
router.post('/:id/activate', requireRole('admin_billing'), activateProject);
router.put(
  '/:id/team-confirmation',
  requireRole('design_mgmt_head'),
  saveTeamConfirmation,
);
router.post(
  '/:id/final-approval',
  requireRole('technical_director', 'executive_director', 'associate_director'),
  recordFinalApproval,
);
router.get('/:id', requireView('dashboard'), getProject);
router.post('/', requireRole(...CREATOR_ROLES), createProject);
router.put('/:id', requireRole(...CREATOR_ROLES), updateProject);
router.patch(
  '/:id/portal-users',
  requireRole('admin_billing'),
  setPortalUsers,
);
router.post(
  '/import',
  requireRole(...CREATOR_ROLES),
  (req, res, next) =>
    uploadSpreadsheet(req, res, (err) =>
      err ? next(err) : importProjects(req, res, next),
    ),
);

export default router;
