import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole, requireView } from '../middlewares/requireRole.js';
import {
  CREATOR_ROLES,
  createProject,
  getProject,
  listProjects,
  projectFilters,
  projectStats,
  updateProject,
} from '../controllers/projects.controller.js';
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
