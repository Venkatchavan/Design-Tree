import { Router } from 'express';
import { INTERNAL_ROLES } from '../config/roles.js';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
  requireView,
  denyRoles,
} from '../middlewares/requireRole.js';
import {
  CREATOR_ROLES,
  activateProject,
  createProject,
  getProject,
  getProjectTeam,
  gfcReadiness,
  listProjects,
  nextJobNumber,
  nextProjectCode,
  projectFilters,
  projectStats,
  recordFinalApproval,
  saveSpocContacts,
  saveTeamConfirmation,
  saveTeamLeads,
  updateProject,
} from '../controllers/projects.controller.js';
import {
  importProjects,
  uploadSpreadsheet,
} from '../controllers/projectImport.controller.js';
import { setPortalUsers } from '../controllers/portal.controller.js';

const router = Router();

router.use(requireAuth);
// Directors are read-only on projects: deny create/update/import even
// though FD/WD would otherwise pass requireRole via the superuser bypass.
const NO_PROJECT_WRITES = ['founding_director', 'working_director', 'executive_director'];
// Project reads are company-wide for internal roles; the controller narrows scoped roles (coordinator, team lead, engineer) to their own projects.
const PROJECT_READERS = INTERNAL_ROLES.filter((r) => r !== 'superuser');
router.get('/', requireRole(...PROJECT_READERS), listProjects);
router.get('/stats', requireView('dashboard'), projectStats);
router.get('/filters', requireRole(...PROJECT_READERS), projectFilters);
router.get('/next-code', denyRoles(...NO_PROJECT_WRITES), requireRole('admin_billing'), nextProjectCode);
router.get('/next-job-number', denyRoles(...NO_PROJECT_WRITES), requireRole('admin_billing'), nextJobNumber);
router.get('/:id/team', requireAuth, getProjectTeam);
router.get('/:id/gfc-readiness', requireInternal(), gfcReadiness);
// SPOC-owned contacts + team leads (admin is read-only on these).
// Principal team leads may also be entered by the Technical Director
// per project / service.
router.put(
  '/:id/spoc-contacts',
  requireRole('coordinator', 'design_mgmt_head'),
  saveSpocContacts,
);
router.put(
  '/:id/team-leads',
  requireRole('coordinator', 'design_mgmt_head', 'technical_director'),
  saveTeamLeads,
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
router.get('/:id', requireRole(...PROJECT_READERS), getProject);
router.post('/', denyRoles(...NO_PROJECT_WRITES), requireRole(...CREATOR_ROLES), createProject);
router.put('/:id', denyRoles(...NO_PROJECT_WRITES), requireRole(...CREATOR_ROLES), updateProject);
router.patch(
  '/:id/portal-users',
  requireRole('admin_billing'),
  setPortalUsers,
);
router.post(
  '/import',
  denyRoles(...NO_PROJECT_WRITES),
  requireRole(...CREATOR_ROLES),
  (req, res, next) =>
    uploadSpreadsheet(req, res, (err) =>
      err ? next(err) : importProjects(req, res, next),
    ),
);

export default router;
