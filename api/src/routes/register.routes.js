import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireView } from '../middlewares/requireRole.js';
import {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
} from '../controllers/register.controller.js';

const router = Router();

// Company transmittal register (§4.9). Reads are project-scoped inside
// the controller; Admin uses the Transmittal page instead.
router.use(requireAuth, requireView('transmittal-log'));
router.get('/', listRecords);
router.get('/:id', getRecord);
const registerWriter=(req,res,next)=>req.user.role==='admin_billing'?next():res.status(403).json({message:'The transmittal register is read-only for this role.'});
router.post('/', registerWriter, createRecord);
router.put('/:id', registerWriter, updateRecord);

export default router;
