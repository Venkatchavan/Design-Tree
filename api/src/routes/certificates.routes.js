import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import {
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
router.use(requireAuth);

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
router.post('/templates', requireRole('admin_billing', 'associate_technical_director'), (req, res, next) =>
  uploadTemplateFile(req, res, (err) =>
    err ? next(err) : addTemplate(req, res, next),
  ),
);
router.get('/templates/:id/download', requireRole(...VIEWERS), downloadTemplate);

router.get('/requests/all', requireRole(...VIEWERS), certRequests.list);
router.post('/requests', requireRole('admin_billing', 'associate_technical_director'), createCertRequest);

router.get('/', requireRole(...VIEWERS), certificates.list);
router.post('/', requireRole('admin_billing'), createCertificate);
router.get('/:id', requireRole(...VIEWERS), certificates.get);
router.get('/:id/file', requireRole(...VIEWERS), downloadCertificate);

export default router;
