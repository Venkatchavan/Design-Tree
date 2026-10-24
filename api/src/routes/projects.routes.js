import { DIRECTOR_ROLES } from '../config/roles.js';
import { Project } from '../models/Project.js';
import { ProjectAudit } from '../models/ProjectAudit.js';
import { projectScopeIds } from '../utils/projectScope.js';
import { PeerReview } from '../models/PeerReview.js';
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
router.use((req,res,next)=>['founding_director','working_director','executive_director'].includes(req.user.role) && req.method!=='GET' ? res.status(403).json({message:'Directors view projects only.'}) : next());
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
router.get('/peer-dashboard', requireRole('peer_reviewer','peer_review_head'), async(req,res,next)=>{
  try {
    const ids=await projectScopeIds(req.user);
    const reviews=await PeerReview.find(ids?{project:{$in:ids}}:{}).lean();
    const reviewIds=reviews.map(r=>r.project).filter(Boolean);
    const filter=ids?{_id:{$in:ids}}:{$or:[{services:{$in:['Peer Review','Peer review']}},{'scope.service':{$in:['Peer Review','Peer review']}},{_id:{$in:reviewIds}}]};
    const projects=await Project.find(filter).sort({updatedAt:-1}).lean();
    const items=projects.map(p=>({...p,pendingReviews:reviews.filter(r=>String(r.project)===String(p._id)&&!r.finalApproved).length}));
    res.json({items,active:items.filter(p=>p.status==='Active').length});
  }catch(e){next(e);}
});
router.get('/:id/history', requireRole('admin_billing',...DIRECTOR_ROLES), async(req,res,next)=>{
  try{
    if(!(await Project.exists({_id:req.params.id})))return res.status(404).json({message:'Project not found.'});
    const page=Math.max(0,Math.min(10000,Number(req.query.page)||0));
    const items=await ProjectAudit.find({project:req.params.id}).sort({at:-1,_id:-1}).skip(page*50).limit(51).lean();
    res.json({items:items.slice(0,50),hasMore:items.length>50});
  }catch(e){next(e);}
});
router.get('/:id/team', requireAuth, getProjectTeam);
router.get('/:id/gfc-readiness', requireInternal(), gfcReadiness);
// SPOC-owned contacts + team leads (admin is read-only on these).
// Principal team leads may also be entered by the Technical Director
// per project / service.
router.put(
  '/:id/spoc-contacts',
  requireRole('coordinator', 'design_mgmt_head', 'technical_director'),
  saveSpocContacts,
);
router.put(
  '/:id/team-leads',
  requireRole('coordinator', 'design_mgmt_head', 'technical_director'),
  saveTeamLeads,
);
router.post('/:id/activate', requireRole('admin_billing', 'technical_director'), activateProject);
router.put(
  '/:id/team-confirmation',
  requireRole('design_mgmt_head', 'technical_director'),
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
