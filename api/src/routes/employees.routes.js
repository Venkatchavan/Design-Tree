import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireUserAdmin,
} from '../middlewares/requireRole.js';
import {
  createEmployee,
  employeeFilters,
  getEmployee,
  listEmployees,
  updateEmployee,
} from '../controllers/employees.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireInternal(), listEmployees);
router.get('/filters', requireInternal(), employeeFilters);
router.get('/:id', requireInternal(), getEmployee);
router.post('/', requireUserAdmin(), createEmployee);
router.put('/:id', requireUserAdmin(), updateEmployee);

export default router;
