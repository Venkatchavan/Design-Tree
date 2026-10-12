import multer from 'multer';
import XLSX from 'xlsx';
import { PROJECT_STATUSES, STAGES } from '../models/Project.js';
import { Project } from '../models/Project.js';
import { requireActiveBranch } from '../utils/branches.js';
import { projectSchema } from '../validation/project.schema.js';

export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx?$|\.csv$/i.test(file.originalname)) return cb(null, true);
    return cb(new Error('Only .xlsx or .csv files are accepted.'));
  },
}).single('file');

const HEADER_MAP = [
  [/^project\s*name$|^project$/i, 'name'],
  [/^project\s*code$|^code$/i, 'code'],
  [/^state$/i, 'state'],
  [/^project\s*type$|^type$/i, 'projectType'],
  [/^branch(\s*name)?$/i, 'branch'],
  [/^used\s*for$/i, 'usedFor'],
  [/^services?$|^service$/i, 'services'],
  [/^source$|^project\s*source$/i, 'source'],
  [/^entity(\s*name)?$/i, 'entityName'],
  [/^location$|^project\s*location$/i, 'locationLabel'],
  [/^client$/i, 'clientName'],
  [/^status$/i, 'status'],
  [/^stage$|^current\s*stage$/i, 'currentStage'],
  [/^job\s*number$/i, 'jobNumber'],
  [/^project\s*director$/i, 'projectDirector'],
];

function parseServices(v) {
  if (v == null || v === '') return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v).split(/[,;|/]/).map((x) => x.trim()).filter(Boolean);
}

function mapRow(raw) {
  const norm = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    const hit = HEADER_MAP.find(([rx]) => rx.test(key));
    if (hit) norm[hit[1]] = typeof v === 'string' ? v.trim() : v;
  }
  return {
    name: norm.name,
    code: norm.code || undefined,
    state: norm.state || undefined,
    projectType: norm.projectType || undefined,
    branch: norm.branch || undefined,
    usedFor: norm.usedFor || undefined,
    services: parseServices(norm.services),
    source: norm.source || undefined,
    entityName: norm.entityName || undefined,
    location: norm.locationLabel ? { label: norm.locationLabel } : undefined,
    clientName: norm.clientName || undefined,
    status:
      norm.status && PROJECT_STATUSES.includes(norm.status)
        ? norm.status
        : undefined,
    currentStage:
      norm.currentStage && STAGES.includes(norm.currentStage)
        ? norm.currentStage
        : undefined,
    jobNumber: norm.jobNumber || undefined,
    related: norm.projectDirector ? { projectDirector: norm.projectDirector } : undefined,
  };
}

export async function importProjects(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName =
      wb.SheetNames.find((n) => /project/i.test(n)) ?? wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: '',
    });
    const docs = [];
    const errors = [];
    for (let i = 0; i < rows.length; i += 1) {
      const raw = rows[i];
      const parsed = projectSchema.safeParse(mapRow(raw));
      if (!parsed.success) {
        const fields = (parsed.error?.issues ?? [])
          .map((iss) => (Array.isArray(iss.path) ? iss.path.join('.') : ''))
          .filter(Boolean)
          .slice(0, 4)
          .join(', ');
        errors.push({
          row: i + 2,
          reason: fields
            ? `Missing or invalid required fields: ${fields}.`
            : 'Missing or invalid required fields.',
        });
        continue;
      }
      if (parsed.data.branch) {
        try {
          parsed.data.branch = await requireActiveBranch(parsed.data.branch);
        } catch (err) {
          errors.push({ row: i + 2, reason: err.message });
          continue;
        }
      }
      if (!parsed.data.code) {
        const year = new Date().getFullYear();
        parsed.data.code = `PRJ-${year}-${String(Date.now()).slice(-6)}${i}`;
      }
      docs.push({
        ...parsed.data,
        code: String(parsed.data.code).toUpperCase(),
        _importRow: i + 2,
      });
    }
    let created = 0;
    if (docs.length > 0) {
      try {
        const inserted = await Project.insertMany(
          docs.map(({ _importRow, ...d }) => d),
          { ordered: false },
        );
        created = inserted.length;
      } catch (err) {
        created = err?.result?.nInserted ?? 0;
        for (const e of err?.writeErrors ?? []) {
          errors.push({
            row: docs[e.index]?._importRow ?? '?',
            reason: e.errmsg?.includes('duplicate')
              ? 'Duplicate project code.'
              : 'Could not import row.',
          });
        }
      }
    }
    return res.status(200).json({ created, errors });
  } catch (err) {
    return next(err);
  }
}
