import { Router } from 'express';
import { generateCertificateLink, certificateLinkAccess, publicCertificateRequest, publicTemplateDownload, publicIssuedDownload, publicCertificateUpload, publicCertificateSave } from '../controllers/publicCertificates.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
  attachIssuedFile,
  uploadFile,
  addTemplate,
  certRequests,
  certificates,
  createCertificate,
  createCertRequest,
  downloadCertificate,
  downloadTemplate,
  listTemplates,
  uploadTemplateFile,
} from '../controllers/certificates.controller.js';

const router = Router();
router.get('/public/:token', certificateLinkAccess, publicCertificateRequest);
router.get('/public/:token/template', certificateLinkAccess, publicTemplateDownload);
router.get('/public/:token/issued', certificateLinkAccess, publicIssuedDownload);
router.post('/public/:token/upload', certificateLinkAccess, publicCertificateUpload, publicCertificateSave);
router.use(requireAuth);
router.post('/requests/:id/link', generateCertificateLink);

// Viewers (§4.5): directors, Admin, HR + DMH read-only reflection.
// Writers: Admin (+ superusers).
const VIEWERS = [
  'admin_billing',
  'hr',
  'executive_director',
  'associate_director',
  'technical_director',
  'assoc_technical_director',
  'design_mgmt_head',
];

router.get('/templates/all', requireRole(...VIEWERS), listTemplates);
router.post('/templates', (req,res,next) => ['admin_billing', 'hr'].includes(req.user.role) ? next() : res.status(403).json({message:'Admin manages certificate requests and templates.'}), (req, res, next) =>
  uploadTemplateFile(req, res, (err) =>
    err ? next(err) : addTemplate(req, res, next),
  ),
);
router.get('/templates/:id/download', requireRole(...VIEWERS), downloadTemplate);

router.get('/requests/all', requireRole(...VIEWERS), certRequests.list);
router.post('/requests', (req,res,next) => ['admin_billing', 'hr'].includes(req.user.role) ? next() : res.status(403).json({message:'Admin manages certificate requests and templates.'}), createCertRequest);

router.get('/', requireRole(...VIEWERS), certificates.list);
router.post('/', (req,res,next) => req.user.role === 'admin_billing' ? next() : res.status(403).json({message:'Admin issues certificates.'}), createCertificate);
router.post('/:id/file', (req,res,next) => req.user.role === 'admin_billing' ? next() : res.status(403).json({message:'Admin uploads issued certificates.'}), uploadFile, attachIssuedFile);
router.get('/:id', requireRole(...VIEWERS), certificates.get);
router.get('/:id/file', requireRole(...VIEWERS), downloadCertificate);

export default router;
