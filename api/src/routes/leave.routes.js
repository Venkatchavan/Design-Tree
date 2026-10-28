import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  denyRoles,
  requireInternal,
  requireRole,
} from '../middlewares/requireRole.js';
import {travelLog} from '../controllers/travelLog.controller.js';
import { SUPER_ROLES } from '../config/roles.js';
import { FLOW_APPROVER_ROLES } from '../config/approvalFlow.js';
import {
  allowances,
  approvalQueue,
  completeAllowance,
  createAllowance,
  createLeave,
  createTravel,
  decideAllowance,
  decideLeave,
  decideTravel,
  deleteHoliday,
  editAllowance,
  editLeave,
  editTravel,
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

// Leave & Travel → Approvals chain: Team Lead → HR → Finance (final).
// FD/WD are superusers that bypass requireRole, so they are denied first —
// they open the tab read-only, exactly like Associate Director does.
const decisionGuards = [
  denyRoles(...SUPER_ROLES),
  (req, res, next) =>
    // denyRoles already handled the superuser case; this keeps every other
    // non-approver role out without duplicating the role list.
    FLOW_APPROVER_ROLES.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: 'You do not approve leave or travel requests.' }),
];

// Leave
router.get('/leave/mine', requireInternal(), myLeaves);
router.get('/leave', requireInternal(), leaves.list);
router.post('/leave', requireInternal(), createLeave);
router.patch('/leave/:id', requireInternal(), editLeave);
router.patch('/leave/:id/decision', ...decisionGuards, decideLeave);

// Travel (+settlement)
router.get('/travel/log', requireRole('hr','admin_billing'), travelLog);
router.get('/travel/mine', requireInternal(), myTravels);
router.get('/travel', requireInternal(), travels.list);
router.post('/travel', requireInternal(), createTravel);
router.patch('/travel/:id', requireInternal(), editTravel);
router.patch('/travel/:id/decision', ...decisionGuards, decideTravel);
router.patch('/travel/:id/settle', requireInternal(), settleTravel);

// LA / Cab / Other
router.get('/allowances/mine', requireInternal(), myAllowances);
router.get('/allowances', requireInternal(), allowances.list);
router.post('/allowances', requireInternal(), createAllowance);
router.patch('/allowances/:id', requireInternal(), editAllowance);
router.patch('/allowances/:id/decision', ...decisionGuards, decideAllowance);
router.patch('/allowances/:id/complete', requireRole('finance'), completeAllowance);

// Review scope helper + pending queue for approvers
router.get('/scope', requireInternal(), teamScopeIds);
router.get(
  '/approvals/queue',
  requireInternal(),
  approvalQueue,
);

// Calendar entry remains HR/Admin only; board roles retain calendar reads for working-day policy.
const HOLIDAY_WRITERS = ['hr', 'admin_billing', 'executive_director'];
router.get('/holidays', requireInternal(), listHolidays);
router.post('/holidays', denyRoles(...SUPER_ROLES), requireRole(...HOLIDAY_WRITERS), holidays.create);
router.delete('/holidays/:id', denyRoles(...SUPER_ROLES), requireRole(...HOLIDAY_WRITERS), deleteHoliday);

export default router;
