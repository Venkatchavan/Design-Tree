import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireUserAdmin,
  requireRole,
} from '../middlewares/requireRole.js';
import {
  createEmployee,
  employeeFilters,
  getEmployee,
  listEmployees,
  listSpocOptions,
  updateEmployee,
} from '../controllers/employees.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireInternal(), listEmployees);
router.get('/filters', requireInternal(), employeeFilters);
router.get('/spoc-options', requireRole('admin_billing', 'technical_director', 'hr'), listSpocOptions);
router.get('/:id', requireInternal(), getEmployee);
router.post('/', requireUserAdmin(), createEmployee);
router.put('/:id', requireUserAdmin(), updateEmployee);

export default router;
