import multer from 'multer';
import XLSX from 'xlsx';
import { PROJECT_STATUSES, STAGES } from '../models/Project.js';
import { Project } from '../models/Project.js';
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
  [/^entity(\s*name)?$/i, 'entityName'],
  [/^location$|^project\s*location$/i, 'locationLabel'],
  [/^client$/i, 'clientName'],
  [/^status$/i, 'status'],
  [/^stage$|^current\s*stage$/i, 'currentStage'],
  [/^job\s*number$/i, 'jobNumber'],
  [/^project\s*director$/i, 'projectDirector'],
];

function mapRow(raw) {
  const norm = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    const hit = HEADER_MAP.find(([rx]) => rx.test(key));
    if (hit) norm[hit[1]] = typeof v === 'string' ? v.trim() : v;
  }
  return {
    name: norm.name,
    code: norm.code,
    state: norm.state,
    projectType: norm.projectType,
    branch: norm.branch,
    usedFor: norm.usedFor,
    entityName: norm.entityName,
    location: { label: norm.locationLabel },
    clientName: norm.clientName,
    status:
      norm.status && PROJECT_STATUSES.includes(norm.status)
        ? norm.status
        : undefined,
    currentStage:
      norm.currentStage && STAGES.includes(norm.currentStage)
        ? norm.currentStage
        : undefined,
    jobNumber: norm.jobNumber,
    related: { projectDirector: norm.projectDirector || 'To be assigned' },
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
    rows.forEach((raw, i) => {
      const parsed = projectSchema.safeParse(mapRow(raw));
      if (!parsed.success) {
        errors.push({ row: i + 2, reason: 'Missing or invalid required fields.' });
        return;
      }
      docs.push({
        ...parsed.data,
        code: parsed.data.code.toUpperCase(),
        _importRow: i + 2,
      });
    });
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
