import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireUserAdmin,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createTeam,
  getTeam,
  listTeams,
  myTeams,
  reportingDirectory,
  companyDirectory,
  setTeamMembers,
  updateTeam,
} from '../controllers/teams.controller.js';

const router = Router();

router.use(requireAuth);
router.use((req,res,next)=>['founding_director','working_director','executive_director'].includes(req.user.role)&&req.method!=='GET'?res.status(403).json({message:'Directors view teams only.'}):next());
router.get('/', requireInternal(), listTeams);
router.get('/mine', requireInternal(), myTeams);
router.get('/reporting-directory', requireRole('associate_director','technical_director','assoc_technical_director'), reportingDirectory);
router.get('/company-directory', requireRole('hr','associate_director','technical_director','assoc_technical_director'), companyDirectory);
router.get('/:id', requireInternal(), getTeam);
router.post('/', requireUserAdmin(), createTeam);
router.put('/:id', requireUserAdmin(), updateTeam);
router.put('/:id/members', requireUserAdmin(), setTeamMembers);

export default router;
