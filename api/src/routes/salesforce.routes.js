import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { denyRoles, requireRole } from '../middlewares/requireRole.js';
import {
  getSalesforceProject,
  salesforceStatus,
  searchSalesforceProjects,
} from '../controllers/salesforce.controller.js';

const router = Router();

router.use(requireAuth);
// Salesforce access is Admin/Billing only. Directors keep the requireRole
// superuser bypass everywhere else, so deny them explicitly here: the
// integration reads commercial data from an external system.
router.use(
  denyRoles('founding_director', 'working_director', 'executive_director'),
);
router.use(requireRole('admin_billing'));

router.get('/status', salesforceStatus);
router.get('/projects', searchSalesforceProjects);
router.get('/projects/:id', getSalesforceProject);

export default router;
