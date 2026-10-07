import multer from 'multer';
import XLSX from 'xlsx';
import { nextNumber } from '../models/Counter.js';
import { Drawing } from '../models/Drawing.js';
import { ImportBatch } from '../models/ImportBatch.js';
import { notifyRoles } from '../models/Notification.js';
import { Project } from '../models/Project.js';
import { isSuperRole } from '../config/roles.js';
import { scopedProjectIds } from './register.controller.js';
import {
  TRANSMITTAL_METHODS,
  TRANSMITTAL_RECIPIENTS,
  TRANSMITTAL_STATUSES,
  Transmittal,
} from '../models/Transmittal.js';
import {
  fromDrawingsSchema,
  importConfirmSchema,
  transmittalSchema,
  transmittalStatusSchema,
  transmittalUpdateSchema,
} from '../validation/phase3.schema.js';

export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx?$|\.csv$/i.test(file.originalname)) return cb(null, true);
    return cb(new Error('Only .xlsx or .csv files are accepted.'));
  },
}).single('file');

const POP = [
  {
    path: 'drawing',
    select: 'drawingNo title service stage rev project',
    populate: { path: 'project', select: 'name code branch' },
  },
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Read-only scoped feed for the TL Transmittal-status tab (§4.21):
// entries for the caller's projects only (superusers see everything).
export async function teamScope(req, res, next) {
  try {
    let items = await Transmittal.find({})
      .populate(POP)
      .sort({ createdAt: -1 })
      .limit(500);
    if (!isSuperRole(req.user.role)) {
      const ids = new Set(await scopedProjectIds(req.user.id));
      items = items.filter((t) =>
        ids.has(t.drawing?.project?._id?.toString() ?? ''),
      );
    }
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function listTransmittals(req, res, next) {
  try {
    const { project, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    let items = await Transmittal.find(filter)
      .populate(POP)
      .sort({ createdAt: -1 })
      .limit(500);
    if (project) {
      items = items.filter(
        (t) => t.drawing?.project?._id?.toString() === project,
      );
    }
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      items = items.filter(
        (t) =>
          rx.test(t.trNo) ||
          rx.test(t.drawing?.drawingNo ?? '') ||
          rx.test(t.drawing?.title ?? '') ||
          rx.test(t._id.toString()),
      );
    }
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
}

export async function getTransmittal(req, res, next) {
  try {
    const doc = await Transmittal.findById(req.params.id).populate(POP);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

async function buildEntry(data, source, by) {
  const drawing = await Drawing.findById(data.drawing);
  if (!drawing) {
    const e = new Error('Drawing not found in the TL list.');
    e.status = 404;
    throw e;
  }
  if (drawing.stage !== 'GFC') {
    const e = new Error('Transmittals are issued only for GFC drawings.');
    e.status = 422;
    throw e;
  }
  if (data.ackAt && data.sentAt && new Date(data.ackAt) < new Date(data.sentAt)) {
    const e = new Error('Acknowledgement cannot precede dispatch.');
    e.status = 422;
    throw e;
  }
  const trNo = data.trNo?.toUpperCase() || (await nextNumber('tr', 'TR'));
  const rev = data.rev ?? drawing.rev;
  const dup = await Transmittal.findOne({ drawing: drawing._id, rev, trNo });
  if (dup) {
    const e = new Error('This drawing, revision and TR number are already logged.');
    e.status = 409;
    throw e;
  }
  const doc = await Transmittal.create({
    trNo,
    date: data.date ?? new Date(),
    drawing: drawing._id,
    rev,
    issuedTo: data.issuedTo,
    method: data.method,
    status: data.status ?? 'Pending',
    sentAt: data.sentAt,
    ackAt: data.ackAt,
    handledBy: data.handledBy,
    remarks: data.remarks,
    source,
    history: [{ by, action: 'Created', detail: `TR ${trNo} logged (${source})` }],
  });
  return doc;
}

export async function createTransmittal(req, res, next) {
  try {
    const parsed = transmittalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    const doc = await buildEntry(parsed.data, 'manual', req.user.id);
    return res.status(201).json({ item: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Duplicate transmittal entry.' });
    }
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    return next(err);
  }
}

export async function updateTransmittal(req, res, next) {
  try {
    const parsed = transmittalUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    if (
      parsed.data.ackAt &&
      parsed.data.sentAt &&
      new Date(parsed.data.ackAt) < new Date(parsed.data.sentAt)
    ) {
      return res
        .status(422)
        .json({ message: 'Acknowledgement cannot precede dispatch.' });
    }
    if (parsed.data.drawing) {
      const source = await Drawing.findById(parsed.data.drawing);
      if (!source || source.stage !== 'GFC') {
        return res.status(422).json({ message: 'Transmittals are issued only for GFC drawings.' });
      }
    }
    const doc = await Transmittal.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    }).populate(POP);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    doc.history.push({ by: req.user.id, action: 'Edited', detail: 'Entry updated' });
    await doc.save();
    return res.status(200).json({ item: doc });
  } catch (err) {
    return next(err);
  }
}

export async function setTransmittalStatus(req, res, next) {
  try {
    const parsed = transmittalStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    const doc = await Transmittal.findById(req.params.id).populate({
      path: 'drawing',
      populate: { path: 'project', select: 'name code' },
    });
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    if (doc.drawing) {
      const drawing = await Drawing.findById(doc.drawing);
      if (!drawing || drawing.stage !== 'GFC') {
        return res.status(422).json({ message: 'Transmittals are issued only for GFC drawings.' });
      }
    }
    const status = parsed.data.status;
    if (status === 'Sent' && !doc.sentAt) doc.sentAt = new Date();
    if (status === 'Acknowledged') {
      // Acknowledgement implies dispatch — stamp it if missing.
      if (!doc.sentAt) doc.sentAt = new Date();
      doc.ackAt = new Date();
      if (doc.ackAt < doc.sentAt) {
        return res
          .status(422)
          .json({ message: 'Acknowledgement cannot precede dispatch.' });
      }
    }
    doc.status = status;
    doc.history.push({
      by: req.user.id,
      action: `Status → ${status}`,
      detail: `TR ${doc.trNo} marked ${status}`,
    });
    await doc.save();
    if (status === 'Sent' || status === 'Acknowledged') {
      await notifyRoles(['team_lead'], {
        title: `Transmittal ${doc.trNo} ${status.toLowerCase()}`,
        detail: `${doc.drawing?.drawingNo ?? ''} · ${doc.drawing?.project?.name ?? ''}`,
        type: 'transmittal',
      });
    }
    return res.status(200).json({ item: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Duplicate drawing or transmittal entry.' });
    }
    return next(err);
  }
}

// TL drawing lists with transmittal status (§4.10 Tab 2).
export async function tlDrawingLists(req, res, next) {
  try {
    const { project, gfcOnly } = req.query;
    const filter = {};
    if (project) filter.project = project;
    if (gfcOnly === 'true') filter.stage = 'GFC';
    const drawings = await Drawing.find(filter)
      .populate('project', 'name code branch')
      .sort({ createdAt: -1 })
      .limit(500);
    const ids = drawings.map((d) => d._id);
    const sent = await Transmittal.distinct('drawing', { drawing: { $in: ids } });
    const sentSet = new Set(sent.map((s) => s.toString()));
    return res.status(200).json({
      items: drawings.map((d) => ({
        id: d._id.toString(),
        project: d.project,
        drawingNo: d.drawingNo,
        title: d.title,
        rev: d.rev,
        service: d.service,
        stage: d.stage,
        sharedBy: d.sharedBy,
        date: d.date,
        transmitted: sentSet.has(d._id.toString()),
        gfc: d.stage === 'GFC',
      })),
      total: drawings.length,
    });
  } catch (err) {
    return next(err);
  }
}

export async function createFromDrawings(req, res, next) {
  try {
    const parsed = fromDrawingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    const drawings = await Drawing.find({
      _id: { $in: parsed.data.drawingIds },
    }).populate('project', 'name code');
    const gfc = drawings.filter((d) => d.stage === 'GFC');
    const skipped = drawings
      .filter((d) => d.stage !== 'GFC')
      .map((d) => d.drawingNo);
    // One TR number per project + recipient.
    const groups = new Map();
    for (const d of gfc) {
      const key = `${d.project?._id ?? 'none'}|${parsed.data.issuedTo}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    const created = [];
    for (const list of groups.values()) {
      const trNo = await nextNumber('tr', 'TR');
      for (const d of list) {
        const exists = await Transmittal.findOne({
          drawing: d._id,
          rev: d.rev,
          trNo,
        });
        if (exists) continue;
        const doc = await Transmittal.create({
          trNo,
          date: parsed.data.date ?? new Date(),
          drawing: d._id,
          rev: d.rev,
          issuedTo: parsed.data.issuedTo,
          method: parsed.data.method,
          status: 'Pending',
          remarks: parsed.data.remarks,
          source: 'tl-list',
          history: [
            {
              by: req.user.id,
              action: 'Created',
              detail: `TR ${trNo} created from TL list`,
            },
          ],
        });
        created.push(doc);
      }
    }
    await notifyRoles(['team_lead'], {
      title: `${created.length} transmittal entries created`,
      detail: `From TL drawing lists (${parsed.data.issuedTo})`,
      type: 'transmittal',
    });
    return res.status(201).json({ created, skipped });
  } catch (err) {
    return next(err);
  }
}

// Integrity report: entries whose drawing is gone or drifted off GFC.
export async function resyncCheck(req, res, next) {
  try {
    const { project } = req.query;
    const entries = await Transmittal.find({})
      .populate({
        path: 'drawing',
        populate: { path: 'project', select: 'name' },
      })
      .limit(1000);
    const issues = [];
    let checked = 0;
    for (const t of entries) {
      if (project && t.drawing?.project?._id?.toString() !== project) continue;
      checked += 1;
      if (!t.drawing) {
        issues.push({ trNo: t.trNo, issue: 'Source drawing no longer exists.' });
      } else if (t.drawing.stage !== 'GFC' && t.status !== 'Cancelled') {
        issues.push({
          trNo: t.trNo,
          issue: `Drawing stage is now ${t.drawing.stage ?? 'unknown'}.`,
        });
      }
    }
    return res.status(200).json({ checked, issues });
  } catch (err) {
    return next(err);
  }
}

export async function exportWorkbook(_req, res, next) {
  try {
    const [entries, drawings] = await Promise.all([
      Transmittal.find({}).populate(POP).sort({ createdAt: 1 }).limit(2000),
      Drawing.find({})
        .populate('project', 'name code')
        .sort({ createdAt: 1 })
        .limit(2000),
    ]);
    const logRows = [
      [
        'TR No', 'Date', 'Project', 'Drawing No', 'Title', 'Service', 'Stage',
        'Rev', 'Issued To', 'Method', 'Status', 'Sent', 'Acknowledged',
        'Handled By', 'Remarks', 'Source', 'Last Updated',
      ],
    ];
    for (const t of entries) {
      logRows.push([
        t.trNo,
        t.date?.toISOString()?.slice(0, 10) ?? '',
        t.drawing?.project?.name ?? '',
        t.drawing?.drawingNo ?? '',
        t.drawing?.title ?? '',
        t.drawing?.service ?? '',
        t.drawing?.stage ?? '',
        t.rev ?? '',
        t.issuedTo,
        t.method,
        t.status,
        t.sentAt?.toISOString()?.slice(0, 10) ?? '',
        t.ackAt?.toISOString()?.slice(0, 10) ?? '',
        t.handledBy ?? '',
        t.remarks ?? '',
        t.source,
        t.updatedAt?.toISOString() ?? '',
      ]);
    }
    const tlRows = [
      ['Project', 'Drawing No', 'Title', 'Rev', 'Service', 'Stage', 'Date Shared', 'Transmitted'],
    ];
    const sentSet = new Set(
      (await Transmittal.distinct('drawing')).map((s) => s.toString()),
    );
    for (const d of drawings) {
      tlRows.push([
        d.project?.name ?? '',
        d.drawingNo,
        d.title,
        d.rev ?? '',
        d.service ?? '',
        d.stage ?? '',
        d.date?.toISOString()?.slice(0, 10) ?? '',
        sentSet.has(d._id.toString()) ? 'Yes' : 'No',
      ]);
    }
    const listsRows = [
      ['Field', 'Valid values'],
      ['Status', TRANSMITTAL_STATUSES.join(', ')],
      ['Issued To', TRANSMITTAL_RECIPIENTS.join(', ')],
      ['Method', TRANSMITTAL_METHODS.join(', ')],
      ['Note', 'Import: blank TR No. rows receive automatic numbers. Blank cells never erase existing data.'],
    ];
    const wb = XLSX.utils.book_new();
    const sheet = (rows) => XLSX.utils.aoa_to_sheet(rows);
    wb.SheetNames.push('Transmittal Log', 'TL drawing list', 'Lists');
    wb.Sheets['Transmittal Log'] = sheet(logRows);
    wb.Sheets['TL drawing list'] = sheet(tlRows);
    wb.Sheets['Lists'] = sheet(listsRows);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="transmittal-log.xlsx"');
    return res.status(200).send(buf);
  } catch (err) {
    return next(err);
  }
}

// ---- Excel import: preview (no writes) ----

const IMPORT_MAP = [
  [/^tr\s*no\.?$|^transmittal\s*no\.?$/i, 'trNo'],
  [/^project$/i, 'projectName'],
  [/^dwg\s*no\.?$|^drawing\s*no\.?$/i, 'drawingNo'],
  [/^title$|^drawing\s*title$/i, 'title'],
  [/^service$/i, 'service'],
  [/^stage$/i, 'stage'],
  [/^rev(ision)?$|^rev\.?$/i, 'rev'],
  [/^issued\s*to$|^recipient$/i, 'issuedTo'],
  [/^method$|^mode$/i, 'method'],
  [/^status$/i, 'status'],
  [/^date$/i, 'date'],
  [/^sent$|^date\s*sent$/i, 'sentAt'],
  [/^ack(nowledged)?(\s*on)?$/i, 'ackAt'],
  [/^handled\s*by$/i, 'handledBy'],
  [/^remarks?$/i, 'remarks'],
];

function normKey(k) {
  return String(k ?? '').trim();
}

function parseDateCell(v) {
  if (v === '' || v == null) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function importPreview(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName =
      wb.SheetNames.find((n) => /transmittal/i.test(n)) ?? wb.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: '',
    });
    const columns = rawRows.length > 0 ? Object.keys(rawRows[0]).map(normKey) : [];
    const rows = [];
    const seenInFile = new Set();
    for (let i = 0; i < rawRows.length; i += 1) {
      const raw = rawRows[i];
      const data = {};
      for (const [k, v] of Object.entries(raw)) {
        const hit = IMPORT_MAP.find(([rx]) => rx.test(normKey(k)));
        if (hit) data[hit[1]] = typeof v === 'string' ? v.trim() : v;
      }
      const rowNo = i + 2;
      const fail = (reason) => rows.push({ row: rowNo, action: 'Error', reason, data });

      if (!data.projectName) return fail('Project must be known.'), undefined;
      const project = await Project.findOne({
        $or: [{ name: data.projectName }, { code: String(data.projectName).toUpperCase() }],
      });
      if (!project) {
        fail(`Unknown project "${data.projectName}".`);
        continue;
      }
      if (!data.drawingNo) {
        fail('Drawing number is required.');
        continue;
      }
      const drawingQuery = { project: project._id, drawingNo: data.drawingNo };
      if (data.rev) drawingQuery.rev = data.rev;
      let drawing = data.rev
        ? await Drawing.findOne(drawingQuery)
        : await Drawing.findOne({ project: project._id, drawingNo: data.drawingNo }).sort({ createdAt: -1 });
      if (!drawing) {
        fail(`Drawing ${data.drawingNo} not in the TL list for ${project.name}.`);
        continue;
      }
      const rev = data.rev || drawing.rev;
      const date = parseDateCell(data.date);
      const sentAt = parseDateCell(data.sentAt);
      const ackAt = parseDateCell(data.ackAt);
      if (data.date && date === null) { fail('Invalid date.'); continue; }
      if (data.sentAt && sentAt === null) { fail('Invalid sent date.'); continue; }
      if (data.ackAt && ackAt === null) { fail('Invalid acknowledgement date.'); continue; }
      if (ackAt && sentAt && ackAt < sentAt) {
        fail('Acknowledgement cannot precede dispatch.');
        continue;
      }
      const issuedTo = data.issuedTo || undefined;
      if (issuedTo && !TRANSMITTAL_RECIPIENTS.includes(issuedTo)) {
        fail(`Invalid recipient "${issuedTo}".`);
        continue;
      }
      const method = data.method || undefined;
      if (method && !TRANSMITTAL_METHODS.includes(method)) {
        fail(`Invalid method "${method}".`);
        continue;
      }
      const status = data.status || undefined;
      if (status && !TRANSMITTAL_STATUSES.includes(status)) {
        fail(`Invalid status "${status}".`);
        continue;
      }
      const fileKey = `${drawing._id}|${rev}|${(data.trNo || '').toUpperCase()}`;
      if (seenInFile.has(fileKey)) {
        fail('Duplicate row in file.');
        continue;
      }
      seenInFile.add(fileKey);

      const clean = {
        projectId: project._id.toString(),
        drawingId: drawing._id.toString(),
        rev,
        trNo: data.trNo?.toUpperCase() || '',
        issuedTo, method, status,
        date: date?.toISOString(),
        sentAt: sentAt?.toISOString(),
        ackAt: ackAt?.toISOString(),
        handledBy: data.handledBy || undefined,
        remarks: data.remarks || undefined,
        correctedNote: data.rev ? undefined : `Revision filled from TL list (${rev ?? '—'})`,
      };

      if (!data.trNo) {
        if (drawing.stage !== 'GFC') {
          fail('Drawing must be at GFC stage for new entries.');
          continue;
        }
        rows.push({ row: rowNo, action: 'New', data: clean });
        continue;
      }
      const existing = await Transmittal.findOne({
        drawing: drawing._id,
        rev,
        trNo: data.trNo.toUpperCase(),
      });
      if (!existing) {
        if (drawing.stage !== 'GFC') {
          fail('Drawing must be at GFC stage for new entries.');
          continue;
        }
        rows.push({ row: rowNo, action: 'New', data: clean });
        continue;
      }
      // Compare for Update vs Unchanged (blank cells never erase).
      const diffs = [];
      const cmp = (field, cur, incoming) => {
        if (incoming === undefined || incoming === '') return;
        const curStr = cur instanceof Date ? cur.toISOString() : String(cur ?? '');
        const inStr = incoming instanceof Date ? incoming.toISOString() : String(incoming ?? '');
        if (curStr !== inStr) diffs.push(field);
      };
      cmp('issuedTo', existing.issuedTo, issuedTo);
      cmp('method', existing.method, method);
      cmp('status', existing.status, status);
      cmp('handledBy', existing.handledBy, data.handledBy);
      cmp('remarks', existing.remarks, data.remarks);
      if (diffs.length === 0) {
        rows.push({ row: rowNo, action: 'Unchanged', data: clean, entryId: existing._id.toString() });
      } else {
        rows.push({
          row: rowNo, action: 'Update', data: clean,
          entryId: existing._id.toString(), reason: `Changes: ${diffs.join(', ')}`,
        });
      }
    }
    return res.status(200).json({ sheet: sheetName, columns, rows });
  } catch (err) {
    return next(err);
  }
}

export async function importConfirm(req, res, next) {
  try {
    const parsed = importConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid data.' });
    }
    const batchEntries = [];
    let created = 0;
    let updated = 0;
    for (const row of parsed.data.rows) {
      if (row.action === 'New') {
        const drawing = await Drawing.findById(row.data.drawingId);
        if (!drawing) continue;
        if (drawing.stage !== 'GFC') continue;
        const trNo = row.trNo || (await nextNumber('tr', 'TR'));
        const dup = await Transmittal.findOne({
          drawing: drawing._id, rev: row.data.rev, trNo,
        });
        if (dup) continue;
        const doc = await Transmittal.create({
          trNo,
          date: row.data.date ? new Date(row.data.date) : new Date(),
          drawing: drawing._id,
          rev: row.data.rev,
          issuedTo: row.data.issuedTo,
          method: row.data.method,
          status: row.data.status ?? 'Pending',
          sentAt: row.data.sentAt ? new Date(row.data.sentAt) : undefined,
          ackAt: row.data.ackAt ? new Date(row.data.ackAt) : undefined,
          handledBy: row.data.handledBy,
          remarks: [
            row.data.remarks,
            row.data.correctedNote ? `(${row.data.correctedNote})` : '',
          ].filter(Boolean).join(' ').trim() || undefined,
          source: 'import',
          history: [{ by: req.user.id, action: 'Imported', detail: `Row imported (${req.body.fileName ?? 'file'})` }],
        });
        batchEntries.push({ action: 'created', entry: doc._id });
        created += 1;
      } else if (row.action === 'Update' && parsed.data.updateExisting && row.entryId) {
        const existing = await Transmittal.findById(row.entryId);
        if (!existing) continue;
        const before = existing.toObject();
        const patch = {};
        for (const f of ['issuedTo', 'method', 'status', 'handledBy', 'remarks']) {
          if (row.data[f] !== undefined && row.data[f] !== '') patch[f] = row.data[f];
        }
        if (row.data.sentAt) patch.sentAt = new Date(row.data.sentAt);
        if (row.data.ackAt) patch.ackAt = new Date(row.data.ackAt);
        Object.assign(existing, patch);
        existing.history.push({
          by: req.user.id, action: 'Import update', detail: 'Updated via Excel import',
        });
        await existing.save();
        batchEntries.push({ action: 'updated', entry: existing._id, before });
        updated += 1;
      }
    }
    const batch = await ImportBatch.create({
      kind: 'transmittal',
      fileName: parsed.data.fileName,
      entries: batchEntries,
      createdBy: req.user.id,
    });
    await Transmittal.updateMany(
      { _id: { $in: batchEntries.map((e) => e.entry) } },
      { importBatch: batch._id },
    );
    return res.status(200).json({ created, updated, batchId: batch._id.toString() });
  } catch (err) {
    return next(err);
  }
}

export async function importUndo(req, res, next) {
  try {
    const batch = await ImportBatch.findById(req.params.batchId);
    if (!batch || batch.undone) {
      return res.status(404).json({ message: 'Import batch not found.' });
    }
    let restored = 0;
    for (const e of batch.entries) {
      if (e.action === 'created') {
        await Transmittal.findByIdAndDelete(e.entry);
        restored += 1;
      } else if (e.action === 'updated' && e.before) {
        const { _id, ...before } = e.before;
        delete before.history;
        await Transmittal.findByIdAndUpdate(e.entry, before, {
          runValidators: false,
        });
        restored += 1;
      }
    }
    batch.undone = true;
    await batch.save();
    return res.status(200).json({ restored });
  } catch (err) {
    return next(err);
  }
}
