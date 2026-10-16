import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireUserAdmin } from '../middlewares/requireRole.js';
import {
  createPortalUser,
  createUser,
  listUsers,
  updateUser,
} from '../controllers/users.controller.js';

const router = Router();

router.use(requireAuth, requireUserAdmin());
router.get('/', listUsers);
router.post('/', createUser);
// External portal logins (client / architect) — never linked to employees.
router.post('/portal', createPortalUser);
router.patch('/:id', updateUser);

export default router;
