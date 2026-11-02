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
// Scoped to the caller's own saved reporting chain, so every internal role may ask;
// people with no reporting links receive an empty directory.
router.get('/reporting-directory', requireInternal(), reportingDirectory);
router.get('/company-directory', requireRole('hr','founding_director','executive_director','associate_director','technical_director','assoc_technical_director'), companyDirectory);
router.get('/:id', requireInternal(), getTeam);
router.post('/', requireUserAdmin(), createTeam);
router.put('/:id', requireUserAdmin(), updateTeam);
router.put('/:id/members', requireUserAdmin(), setTeamMembers);

export default router;
