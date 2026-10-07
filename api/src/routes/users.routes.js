import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireUserAdmin } from '../middlewares/requireRole.js';
import {
  createUser,
  listUsers,
  updateUser,
} from '../controllers/users.controller.js';

const router = Router();

router.use(requireAuth, requireUserAdmin());
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);

export default router;
