import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal, requireRole } from '../middlewares/requireRole.js';
import {
  createFromDrawings,
  createTransmittal,
  exportWorkbook,
  getTransmittal,
  importConfirm,
  importPreview,
  importUndo,
  listTransmittals,
  resyncCheck,
  setTransmittalStatus,
  teamScope,
  tlDrawingLists,
  updateTransmittal,
  uploadSpreadsheet,
} from '../controllers/transmittals.controller.js';

const router = Router();

// Scoped read-only feed for the TL tab — registered BEFORE the Admin guard.
router.get('/team-scope', requireAuth, requireInternal(), teamScope);

// Admin Transmittal page (§4.10) — Admin only (+FD/WD superusers).
router.use(requireAuth, requireRole('admin_billing'));

router.get('/', listTransmittals);
router.get('/tl-drawings', tlDrawingLists);
router.get('/resync', resyncCheck);
router.get('/export', exportWorkbook);
router.get('/:id', getTransmittal);
router.post('/', createTransmittal);
router.put('/:id', updateTransmittal);
router.patch('/:id/status', setTransmittalStatus);
router.post('/from-drawings', createFromDrawings);
router.post('/import/preview', (req, res, next) =>
  uploadSpreadsheet(req, res, (err) =>
    err ? next(err) : importPreview(req, res, next),
  ),
);
router.post('/import/confirm', importConfirm);
router.post('/import/:batchId/undo', importUndo);

export default router;
