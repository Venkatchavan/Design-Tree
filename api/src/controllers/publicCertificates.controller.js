import mongoose from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';
import { Certificate, CertRequest, CertTemplate } from '../models/Certificate.js';
import { removeFile, sendDownload, uploadSingle } from '../utils/storage.js';

const hash = token => createHash('sha256').update(token).digest('hex');
export const publicCertificateUpload = uploadSingle('file', 'certificates');

export async function generateCertificateLink(req, res, next) {
  try {
    if (req.user.role !== 'admin_billing') return res.status(403).json({ message: 'Admin generates client certificate links.' });
    const token = randomBytes(32).toString('hex');
    const days = Math.max(1, Number(process.env.CERTIFICATE_LINK_DAYS) || 30);
    const doc = await CertRequest.findByIdAndUpdate(req.params.id, { linkHash: hash(token), linkExpiresAt: new Date(Date.now() + days * 86400000) }, { returnDocument: 'after' });
    if (!doc) return res.status(404).json({ message: 'Request not found.' });
    return res.json({ path: `/certificate-request/${token}`, expiresAt: doc.linkExpiresAt });
  } catch (err) { return next(err); }
}

export async function certificateLinkAccess(req, res, next) {
  try {
    if (!/^[0-9a-f]{64}$/.test(req.params.token)) return res.status(404).json({ message: 'Certificate link is unavailable.' });
    const request = await CertRequest.findOne({ linkHash: hash(req.params.token), linkExpiresAt: { $gt: new Date() } }).populate('project', 'name code');
    if (!request) return res.status(404).json({ message: 'Certificate link has expired or was replaced.' });
    req.certificateRequest = request;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return next();
  } catch (err) { return next(err); }
}

export async function publicCertificateRequest(req, res, next) {
  try {
    const r = req.certificateRequest;
    const template = await CertTemplate.exists({ category: r.category });
    const issued = await Certificate.exists({ project: r.project._id, certType: r.category, status: 'Issued', file: { $exists: true, $ne: '' } });
    return res.json({ project: r.project.name, code: r.project.code, category: r.category, status: r.status, template: !!template, issued: !!issued });
  } catch (err) { return next(err); }
}

export async function publicTemplateDownload(req, res, next) {
  try {
    const doc = await CertTemplate.findOne({ category: req.certificateRequest.category });
    if (!doc) return res.status(404).json({ message: 'Template not yet available.' });
    return sendDownload(res, doc.file, next);
  } catch (err) { return next(err); }
}

export async function publicIssuedDownload(req, res, next) {
  try {
    const r = req.certificateRequest;
    const doc = await Certificate.findOne({ project: r.project._id, certType: r.category, status: 'Issued', file: { $exists: true, $ne: '' } }).sort({ issuedDate: -1 });
    if (!doc) return res.status(404).json({ message: 'Issued certificate not yet available.' });
    return sendDownload(res, doc.file, next);
  } catch (err) { return next(err); }
}

export async function publicCertificateSave(req, res, next) {
  try {
    const r = req.certificateRequest;
    if (!req.file) return res.status(400).json({ message: 'Choose a certificate file.' });
    if (r.status !== 'Sent') { removeFile(`certificates/${req.file.filename}`); return res.status(409).json({ message: 'A certificate has already been submitted for this request.' }); }
    const certificateId = new mongoose.Types.ObjectId();
    const { status } = await CertRequest.findOneAndUpdate({ _id: r._id, status: 'Sent' }, { status: 'Uploaded', uploadedCertificate: certificateId }, { returnDocument: 'after' }) ?? {};
    if (!status) { removeFile(`certificates/${req.file.filename}`); return res.status(409).json({ message: 'Request changed. Refresh and retry.' }); }
    req.uploadReservation = certificateId;
    await Certificate.create({ _id: certificateId, project: r.project._id, request: r._id, certType: r.category, status: 'Uploaded', file: `certificates/${req.file.filename}` });
    return res.status(201).json({ status: 'Uploaded', message: 'Certificate uploaded.' });
  } catch (err) {
    if (req.file) removeFile(`certificates/${req.file.filename}`);
    if (req.uploadReservation) await CertRequest.updateOne({ _id: req.certificateRequest._id, uploadedCertificate: req.uploadReservation }, { $set: {status:'Sent'}, $unset:{uploadedCertificate:1} }).catch(() => {});
    return next(err);
  }
}
