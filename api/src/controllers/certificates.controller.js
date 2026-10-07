import {
  Certificate,
  CertRequest,
  CertTemplate,
} from '../models/Certificate.js';
import { makeCrud } from '../utils/crud.js';
import {
  removeFile,
  sendDownload,
  uploadSingle,
} from '../utils/storage.js';
import {
  certificateSchema,
  certRequestSchema,
} from '../validation/phase3.schema.js';

const POP_PROJ = 'name code branch';

// Client / issued certificate files.
export const uploadFile = uploadSingle('file', 'certificates');
// Template files.
export const uploadTemplateFile = uploadSingle('file', 'templates');

export const certificates = makeCrud(Certificate, {
  create: certificateSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function createCertificate(req, res, next) {
  const parsed = certificateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await Certificate.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function listTemplates(_req, res, next) {
  try {
    const items = await CertTemplate.find({}).sort({ category: 1 });
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function addTemplate(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No template file uploaded.' });
    }
    const category = String(req.body?.category ?? '').trim();
    if (!category) {
      removeFile(`templates/${req.file.filename}`);
      return res.status(400).json({ message: 'Certificate category is required.' });
    }
    const doc = await CertTemplate.findOneAndUpdate(
      { category },
      {
        category,
        file: `templates/${req.file.filename}`,
        uploadedBy: req.user.id,
      },
      { upsert: true, new: true, returnDocument: 'after' },
    );
    return res.status(201).json({ item: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Template category already exists.' });
    }
    return next(err);
  }
}

export async function downloadTemplate(req, res, next) {
  try {
    const doc = await CertTemplate.findById(req.params.id);
    if (!doc || !doc.file) return res.status(404).json({ message: 'Not found.' });
    return sendDownload(res, doc.file, next);
  } catch (err) {
    return next(err);
  }
}

export async function downloadCertificate(req, res, next) {
  try {
    const doc = await Certificate.findById(req.params.id);
    if (!doc || !doc.file) return res.status(404).json({ message: 'Not found.' });
    return sendDownload(res, doc.file, next);
  } catch (err) {
    return next(err);
  }
}

export const certRequests = makeCrud(CertRequest, {
  create: certRequestSchema,
  filters: (req) => {
    const f = {};
    if (req.query.project) f.project = req.query.project;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  populate: [{ path: 'project', select: POP_PROJ }],
});

export async function createCertRequest(req, res, next) {
  const parsed = certRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data.' });
  }
  try {
    const doc = await CertRequest.create({
      ...parsed.data,
      createdBy: req.user.id,
    });
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}
