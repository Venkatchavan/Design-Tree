import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
  requireUserAdmin,
} from '../middlewares/requireRole.js';
import {
  allowances,
  approvalQueue,
  createAllowance,
  createLeave,
  createTravel,
  decideAllowance,
  decideLeave,
  decideTravel,
  holidays,
  leaves,
  listHolidays,
  myAllowances,
  myLeaves,
  myTravels,
  settleTravel,
  teamScopeIds,
  travels,
} from '../controllers/leaveTravel.controller.js';

const router = Router();
router.use(requireAuth);

const LEAVE_APPROVERS = [
  'team_lead',
  'assoc_technical_director',
  'technical_director',
  'hr',
];
const TRAVEL_APPROVERS = [...LEAVE_APPROVERS, 'finance'];

// Leave
router.get('/leave/mine', requireInternal(), myLeaves);
router.get('/leave', requireInternal(), leaves.list);
router.post('/leave', requireInternal(), createLeave);
router.patch('/leave/:id/decision', requireRole(...LEAVE_APPROVERS), decideLeave);

// Travel (+settlement)
router.get('/travel/mine', requireInternal(), myTravels);
router.get('/travel', requireInternal(), travels.list);
router.post('/travel', requireInternal(), createTravel);
router.patch('/travel/:id/decision', requireRole(...TRAVEL_APPROVERS), decideTravel);
router.patch('/travel/:id/settle', requireInternal(), settleTravel);

// LA / Cab / Other
router.get('/allowances/mine', requireInternal(), myAllowances);
router.get('/allowances', requireInternal(), allowances.list);
router.post('/allowances', requireInternal(), createAllowance);
router.patch('/allowances/:id/decision', requireRole('finance'), decideAllowance);

// Review scope helper + pending queue for approvers
router.get('/scope', requireInternal(), teamScopeIds);
router.get(
  '/approvals/queue',
  requireRole(...TRAVEL_APPROVERS, 'admin_billing'),
  approvalQueue,
);

// Holidays
router.get('/holidays', requireInternal(), listHolidays);
router.post('/holidays', requireUserAdmin(), holidays.create);

export default router;
