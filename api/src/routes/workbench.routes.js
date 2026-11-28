import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireInternal } from '../middlewares/requireRole.js';
import { dtPrAccess } from '../controllers/dtPeerReview.controller.js';
import { WorkbenchDoc } from '../models/WorkbenchDoc.js';
import { User } from '../models/User.js';

// Peer Review dashboard tab (IS design workbench, 28 Nov 2026) in DT Peer Review. Same people as
// DT Peer Review, by role:
//  - review team (and the Peer Review Head): create projects/elements, save
//    revisions, Mark checked;
//  - Admin allotters (Arpitha, Sandeep) and the Peer Review Head: also Approve
//    and Return to draft (the DT Peer Review approval authority);
//  - Srinivasa Rao and the Founding Directors: view only.
const router = Router();
router.use(requireAuth, requireInternal());

const SEG = '[A-Za-z0-9_-]{1,64}';
const DOC_RE = new RegExp(`^projects/${SEG}(/(elements|history)/${SEG}|/analysis/main)?$`);
const COL_RE = new RegExp(`^projects(/${SEG}/(elements|history))?$`);
const fail = (status, message) => Object.assign(new Error(message), { status });

async function rights(user) {
  const a = await dtPrAccess(user);
  const write = (a.reviewer || a.head || a.allot) && !a.viewer;
  return { read: a.read, write, approve: write && (a.allot || a.head) };
}
async function gate(req, need) {
  const r = await rights(req.user);
  if (!r.read) throw fail(403, 'You do not have access to the Peer Review dashboard.');
  if (need && !r[need]) throw fail(403, need === 'approve' ? 'Only the Admin allotters or the Peer Review Head can approve.' : 'View only: you cannot change the Peer Review dashboard.');
  return r;
}
const parse = (d) => { try { return JSON.parse(d.json); } catch { return {}; } };
const docId = (p) => p.slice(p.lastIndexOf('/') + 1);

router.get('/me', async (req, res, next) => {
  try {
    const r = await gate(req);
    const me = await User.findById(req.user.id).select('name').lean();
    res.json({ id: String(req.user.id), name: me?.name ?? '', canWrite: r.write, canApprove: r.approve });
  } catch (e) { next(e); }
});

router.get('/col', async (req, res, next) => {
  try {
    await gate(req);
    const path = String(req.query.path ?? '');
    if (!COL_RE.test(path)) throw fail(400, 'Bad collection path.');
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 1000));
    const sort = req.query.orderBy === 'at' ? { at: req.query.dir === 'asc' ? 1 : -1 } : { createdAt: 1 };
    const rows = await WorkbenchDoc.find({ parent: path }).sort(sort).limit(limit).lean();
    res.json({ docs: rows.map((d) => ({ id: docId(d.path), data: parse(d) })) });
  } catch (e) { next(e); }
});

router.get('/doc', async (req, res, next) => {
  try {
    await gate(req);
    const path = String(req.query.path ?? '');
    if (!DOC_RE.test(path)) throw fail(400, 'Bad document path.');
    const d = await WorkbenchDoc.findOne({ path }).lean();
    res.json({ exists: !!d, data: d ? parse(d) : null });
  } catch (e) { next(e); }
});

router.put('/doc', async (req, res, next) => {
  try {
    const path = String(req.body?.path ?? '');
    const data = req.body?.data;
    if (!DOC_RE.test(path) || !data || typeof data !== 'object') throw fail(400, 'Bad document.');
    const r = await gate(req, 'write');
    if (/\/elements\//.test(path)) {
      const prev = await WorkbenchDoc.findOne({ path }).lean();
      const was = prev ? parse(prev).state ?? 'Draft' : 'Draft';
      const next = data.state ?? 'Draft';
      const last = (data.approvals ?? [])[(data.approvals ?? []).length - 1];
      // Approving, or returning an approved/checked element to draft without a new
      // revision, is the approval authority's call. A saved revision (rev goes up)
      // resets the state to Draft for anyone with edit rights.
      const revUp = prev && Number(data.rev ?? 0) > Number(parse(prev).rev ?? 0);
      if ((next === 'Approved' && was !== 'Approved') || (next === 'Draft' && was !== 'Draft' && !revUp && last?.action === 'Draft')) {
        if (!r.approve) throw fail(403, 'Only the Admin allotters or the Peer Review Head can approve or return to draft.');
      }
    }
    const parent = path.slice(0, path.lastIndexOf('/'));
    await WorkbenchDoc.updateOne(
      { path },
      { $set: { parent, json: JSON.stringify(data), at: String(data.at ?? data.updatedAt ?? ''), updatedBy: req.user.id } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/doc', async (req, res, next) => {
  try {
    await gate(req, 'write');
    const path = String(req.query.path ?? '');
    if (!DOC_RE.test(path)) throw fail(400, 'Bad document path.');
    const d = await WorkbenchDoc.findOne({ path }).lean();
    if (d && parse(d).state === 'Approved' && !(await rights(req.user)).approve) throw fail(403, 'An approved element can only be deleted by the approval authority.');
    await WorkbenchDoc.deleteOne({ path });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/profiles', async (req, res, next) => {
  try {
    await gate(req);
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((x) => /^[a-f0-9]{24}$/i.test(String(x))).slice(0, 200);
    const users = await User.find({ _id: { $in: ids } }).select('name').lean();
    res.json(Object.fromEntries(users.map((u) => [String(u._id), { name: u.name }])));
  } catch (e) { next(e); }
});

export default router;
