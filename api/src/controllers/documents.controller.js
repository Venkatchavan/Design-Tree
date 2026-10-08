import { AllowanceRequest } from '../models/AllowanceRequest.js';
import { Drawing } from '../models/Drawing.js';
import { Employee } from '../models/Employee.js';
import { MarketingBrief } from '../models/Marketing.js';
import { SiteVisit } from '../models/SiteVisit.js';
import { User } from '../models/User.js';
import { isSuperRole } from '../config/roles.js';
import { sendDownload, uploadMany, uploadSingle } from '../utils/storage.js';

export const visitPhotosUpload = uploadMany('photos', 'visits', 10);
export const billUpload = uploadSingle('bill', 'bills');
export const briefPhotosUpload = uploadMany('photos', 'marketing', 10);
export const employeeDocUpload = uploadSingle('file', 'employees');
export const drawingProofUpload = uploadSingle('proof', 'drawings');
export const financeOccUpload = uploadMany('files', 'finance-occ', 10, 20 * 1024 * 1024);

export async function addFinanceOccDocs(req, res, next) {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ message: 'No files uploaded.' });
    }
    const { FinanceOccEntry } = await import('../models/FinanceOccEntry.js');
    const doc = await FinanceOccEntry.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    doc.docs.push(
      ...req.files.map((f) => ({ name: f.originalname, file: `finance-occ/${f.filename}` })),
    );
    doc.history.push({ by: req.user.id, action: `${req.files.length} document(s) attached` });
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function addVisitPhotos(req, res, next) {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ message: 'No photos uploaded.' });
    }
    const doc = await SiteVisit.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    doc.photos.push(...req.files.map((f) => `visits/${f.filename}`));
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setAllowanceBill(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No bill uploaded.' });
    }
    const doc = await AllowanceRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    const me = await User.findById(req.user.id);
    const mine =
      me?.employee != null && doc.employee?.toString() === me.employee.toString();
    if (!mine && req.user.role !== 'finance' && !isSuperRole(req.user.role)) {
      return res.status(403).json({
        message: 'Only the requester or Finance can attach this bill.',
      });
    }
    doc.bill = `bills/${req.file.filename}`;
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function addBriefPhotos(req, res, next) {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ message: 'No photos uploaded.' });
    }
    const doc = await MarketingBrief.findOneAndUpdate(
      { project: req.params.projectId },
      {
        $push: {
          photos: {
            $each: req.files.map((f) => `marketing/${f.filename}`),
          },
        },
      },
      { upsert: true, new: true, returnDocument: 'after' },
    );
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function addEmployeeDoc(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const doc = await Employee.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Employee not found.' });
    doc.documents.push({
      name: req.body?.name?.trim() || req.file.originalname,
      file: `employees/${req.file.filename}`,
      by: req.user.id,
    });
    await doc.save();
    return res.status(201).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setDrawingProof(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No proof uploaded.' });
    }
    const doc = await Drawing.findByIdAndUpdate(
      req.params.id,
      { proof: `drawings/${req.file.filename}` },
      { new: true, returnDocument: 'after', runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

// Authenticated download for any stored document (internal roles only).
export async function downloadStored(req, res, next) {
  try {
    const stored = (req.params.splat ?? []).join('/');
    return sendDownload(res, stored, next);
  } catch (err) {
    return next(err);
  }
}
