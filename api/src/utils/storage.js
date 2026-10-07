import * as fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

// Central document storage (node:fs backed, no new dependencies).
// Stored names are either legacy bare filenames (uploads/ root) or
// `subdir/filename` for files saved through this util.

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function safeFilename(original) {
  const base = path
    .basename(String(original ?? 'file'))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  return `${Date.now()}-${base || 'file'}`;
}

export function documentStorage(subdir = '') {
  const dest = subdir ? path.join(UPLOAD_DIR, subdir) : UPLOAD_DIR;
  fs.mkdirSync(dest, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
  });
}

export function uploadSingle(
  field = 'file',
  subdir = '',
  maxBytes = MAX_FILE_BYTES,
) {
  return multer({
    storage: documentStorage(subdir),
    limits: { fileSize: maxBytes },
  }).single(field);
}

export function uploadMany(
  field = 'files',
  subdir = '',
  maxCount = 10,
  maxBytes = MAX_FILE_BYTES,
) {
  return multer({
    storage: documentStorage(subdir),
    limits: { fileSize: maxBytes },
  }).array(field, maxCount);
}

// Resolve a stored name to an absolute path. Rejects path traversal.
export function resolveFile(stored) {
  const rel = String(stored ?? '').replace(/\\/g, '/');
  if (!rel || rel.includes('\0')) {
    throw Object.assign(new Error('Invalid file path.'), { status: 400 });
  }
  const full = path.resolve(UPLOAD_DIR, rel);
  if (full !== UPLOAD_DIR && !full.startsWith(UPLOAD_DIR + path.sep)) {
    throw Object.assign(new Error('Invalid file path.'), { status: 400 });
  }
  return full;
}

export function removeFile(stored) {
  try {
    fs.unlinkSync(resolveFile(stored));
  } catch {
    /* already gone — nothing to do */
  }
}

export function sendDownload(res, stored, next) {
  let full;
  try {
    full = resolveFile(stored);
  } catch (err) {
    if (next) return next(err);
    return res.status(400).json({ message: 'Invalid file path.' });
  }
  if (!fs.existsSync(full)) {
    return res.status(404).json({ message: 'File not found on disk.' });
  }
  return res.download(full, path.basename(full));
}
