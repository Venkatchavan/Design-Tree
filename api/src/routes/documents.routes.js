import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireInternal,
  requireRole,
  requireUserAdmin,
} from '../middlewares/requireRole.js';
import {
  addBriefPhotos,
  addEmployeeDoc,
  addVisitPhotos,
  billUpload,
  briefPhotosUpload,
  downloadStored,
  drawingProofUpload,
  employeeDocUpload,
  setAllowanceBill,
  setDrawingProof,
  visitPhotosUpload,
} from '../controllers/documents.controller.js';

const router = Router();
router.use(requireAuth);

// Internal-only download for every stored document.
router.get('/files/*splat', requireInternal(), downloadStored);

// Site-visit photos (QA/QC).
router.post(
  '/visits/:id/photos',
  requireRole('qaqc'),
  (req, res, next) =>
    visitPhotosUpload(req, res, (err) =>
      err ? next(err) : addVisitPhotos(req, res, next),
    ),
);

// Allowance bill attachment (requester or Finance).
router.post(
  '/allowances/:id/bill',
  requireInternal(),
  (req, res, next) =>
    billUpload(req, res, (err) =>
      err ? next(err) : setAllowanceBill(req, res, next),
    ),
);

// Marketing brief photos.
router.post(
  '/brief/:projectId/photos',
  requireRole('marketing'),
  (req, res, next) =>
    briefPhotosUpload(req, res, (err) =>
      err ? next(err) : addBriefPhotos(req, res, next),
    ),
);

// Employee documents (HR profile).
router.post(
  '/employees/:id/documents',
  requireUserAdmin(),
  (req, res, next) =>
    employeeDocUpload(req, res, (err) =>
      err ? next(err) : addEmployeeDoc(req, res, next),
    ),
);

// Drawing email-proof screenshot / PDF.
router.post(
  '/drawings/:id/proof',
  requireRole('team_lead', 'assoc_technical_director', 'technical_director', 'engineer_drafter'),
  (req, res, next) =>
    drawingProofUpload(req, res, (err) =>
      err ? next(err) : setDrawingProof(req, res, next),
    ),
);

export default router;
