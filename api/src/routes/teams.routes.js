import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireUserAdmin,
} from '../middlewares/requireRole.js';
import {
  createTeam,
  getTeam,
  listTeams,
  myTeams,
  setTeamMembers,
  updateTeam,
} from '../controllers/teams.controller.js';

const router = Router();

router.use(requireAuth);
router.use((req,res,next)=>req.user.role==='founding_director'&&req.method!=='GET'?res.status(403).json({message:'MD views teams only.'}):next());
router.get('/', requireInternal(), listTeams);
router.get('/mine', requireInternal(), myTeams);
router.get('/:id', requireInternal(), getTeam);
router.post('/', requireUserAdmin(), createTeam);
router.put('/:id', requireUserAdmin(), updateTeam);
router.put('/:id/members', requireUserAdmin(), setTeamMembers);

export default router;
