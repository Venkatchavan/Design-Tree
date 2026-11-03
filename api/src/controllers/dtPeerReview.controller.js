import mongoose from 'mongoose';
import {
  DtPeerReview, DT_PR_STAGES, DT_PR_CHECKLIST, DT_PR_DELIVERABLES, DT_PR_ITEM_STATUS,
  DT_PR_APPROVAL_STATUS, DT_PR_TEAM_ROLES, DT_PR_RESPONSE_TARGET_DAYS,
} from '../models/DtPeerReview.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { expandServices } from '../config/services.js';
import { projectScopeIds, canReadProject } from '../utils/projectScope.js';

const id = (v) => String(v?._id ?? v ?? '');
const DAY = 86400000;
const fail = (status, message) => Object.assign(new Error(message), { status });
const fullName = (e) => (e ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') : '');
const isClosedItem = (s) => s === 'Verified' || s === 'N.A.';
const isDone = (s) => s === 'Approved' || s === 'N.A.';
const POP = [
  ...DT_PR_TEAM_ROLES.map((r) => ({ path: `team.${r.key}`, select: 'firstName middleName lastName empId designation' })),
  { path: 'project', select: 'name code jobNumber services status branch' },
];

// Peer Review applies to Structural services; a project qualifies when its
// saved services include Structural (incl. SMEP/SMEPF) or Peer Review.
const eligible = (p) => expandServices(p.services ?? []).some((s) => s === 'Structural' || s === 'Peer Review');

export function commentState(c, now = Date.now()) {
  const rounds = c.rounds ?? [];
  const last = rounds[rounds.length - 1];
  const closedAt = rounds.find((r) => r.verdict === 'Closed');
  if (last?.verdict === 'Closed') {
    const first = rounds[0]?.commentDate;
    const days = first && last.commentDate ? (new Date(last.commentDate) - new Date(first)) / DAY : null;
    return { open: false, label: 'Closed', closureDays: days, closedAt: closedAt?.commentDate ?? null, overdue: false };
  }
  const awaitingDt = !!last?.response?.trim();
  const since = awaitingDt ? last.responseDate : last?.commentDate;
  const overdue = !!since && (now - new Date(since)) / DAY > DT_PR_RESPONSE_TARGET_DAYS;
  return { open: true, label: awaitingDt ? 'Awaiting DesignTree review' : 'Awaiting consultant response', closureDays: null, overdue };
}

export function summarize(doc, now = Date.now()) {
  const checklist = doc.checklist ?? [];
  const comments = (doc.comments ?? []).map((c) => ({ ...c, state: commentState(c, now) }));
  const open = comments.filter((c) => c.state.open);
  const closed = comments.filter((c) => !c.state.open);
  const closureDays = closed.map((c) => c.state.closureDays).filter((d) => Number.isFinite(d));
  const stages = DT_PR_STAGES.map((s) => {
    const saved = (doc.stages ?? []).find((x) => x.code === s.code) ?? {};
    const items = checklist.filter((i) => i.stage === s.code);
    const itemsClosed = items.filter((i) => isClosedItem(i.status)).length;
    const openComments = open.filter((c) => c.stage === s.code).length;
    const signedOff = saved.signedOff?.at ? saved.signedOff : null;
    const started = items.some((i) => i.status !== 'Not Started') || comments.some((c) => c.stage === s.code);
    const status = signedOff ? 'Signed off' : openComments ? 'Open comments' : started ? 'In review' : 'Not started';
    const canSignOff = !signedOff && items.length > 0 && itemsClosed === items.length && openComments === 0;
    return { ...s, items: items.length, itemsClosed, openComments, signedOff, status, canSignOff };
  });
  const signed = stages.filter((s) => s.signedOff).length;
  const current = stages.find((s) => !s.signedOff) ?? null;
  const approvals = doc.approvals ?? [];
  const approvalsDone = approvals.filter((a) => isDone(a.status)).length;
  const itemsClosed = checklist.filter((i) => isClosedItem(i.status)).length;
  const blockers = [];
  if (open.length) blockers.push(`${open.length} review comment${open.length === 1 ? '' : 's'} not closed`);
  if (signed < stages.length) blockers.push(`${stages.length - signed} of ${stages.length} stages not signed off`);
  if (approvalsDone < approvals.length) blockers.push(`${approvals.length - approvalsDone} of ${approvals.length} approvals outstanding`);
  const released = doc.released?.at ? doc.released : null;
  return {
    status: released ? 'Released for issue' : blockers.length ? 'Blocked — not ready for issue' : 'Ready for issue',
    blocked: !released && blockers.length > 0,
    blockers,
    released,
    checklist: {
      total: checklist.length, closed: itemsClosed,
      pct: checklist.length ? Math.round((itemsClosed / checklist.length) * 100) : 0,
      verified: checklist.filter((i) => i.status === 'Verified').length,
      inProgress: checklist.filter((i) => i.status === 'In Progress').length,
      notStarted: checklist.filter((i) => i.status === 'Not Started').length,
      na: checklist.filter((i) => i.status === 'N.A.').length,
    },
    stages, signed, current: current ? `Stage ${current.code.slice(1)} · ${current.name}` : 'All stages signed off',
    comments: {
      total: comments.length, open: open.length, closed: closed.length,
      awaitingConsultant: open.filter((c) => c.state.label === 'Awaiting consultant response').length,
      awaitingDt: open.filter((c) => c.state.label === 'Awaiting DesignTree review').length,
      overdue: open.filter((c) => c.state.overdue).length,
      avgClosureDays: closureDays.length ? Math.round((closureDays.reduce((a, b) => a + b, 0) / closureDays.length) * 10) / 10 : null,
    },
    approvals: { total: approvals.length, done: approvalsDone },
    commentStates: Object.fromEntries(comments.map((c) => [id(c._id), c.state])),
  };
}

async function actor(req) {
  const me = await User.findById(req.user.id).select('employee name').populate('employee', 'firstName middleName lastName').lean();
  return { employee: me?.employee?._id ?? null, name: fullName(me?.employee) || me?.name || 'Unknown' };
}
const stampOf = (a) => ({ by: a.employee, byName: a.name, at: new Date() });

async function loadPackage(req, { write = false } = {}) {
  if (!mongoose.isValidObjectId(req.params.id)) throw fail(404, 'Peer review package not found.');
  const doc = await DtPeerReview.findById(req.params.id);
  if (!doc || !(await canReadProject(req.user, doc.project))) throw fail(404, 'Peer review package not found.');
  if (write && doc.released?.at) throw fail(409, 'This package is Released for Issue and is now read-only.');
  return doc;
}
async function respond(res, doc, status = 200) {
  const full = await DtPeerReview.findById(doc._id).populate(POP).lean();
  return res.status(status).json({ item: full, summary: summarize(full) });
}
const handle = (fn) => async (req, res, next) => {
  try { return await fn(req, res); } catch (err) { if (err.status) return res.status(err.status).json({ message: err.message }); return next(err); }
};
const text = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const date = (v) => { if (!v) return null; const d = new Date(v); if (Number.isNaN(d.getTime())) throw fail(400, 'Enter a valid date.'); return d; };

export const meta = handle(async (req, res) => {
  const ids = await projectScopeIds(req.user);
  const projects = (await Project.find(ids ? { _id: { $in: ids } } : {}).select('name code jobNumber services status').sort({ name: 1 }).lean()).filter(eligible);
  res.json({
    stages: DT_PR_STAGES, deliverables: DT_PR_DELIVERABLES, itemStatus: DT_PR_ITEM_STATUS,
    approvalStatus: DT_PR_APPROVAL_STATUS, teamRoles: DT_PR_TEAM_ROLES, responseTargetDays: DT_PR_RESPONSE_TARGET_DAYS,
    projects,
    // Team pickers for the Peer Review team only.
    employees: ['peer_reviewer', 'peer_review_head'].includes(req.user.role)
      ? (await Employee.find({ status: { $ne: 'Exited' } }).select('firstName middleName lastName empId designation department').sort({ firstName: 1 }).lean())
      : [],
  });
});

export const list = handle(async (req, res) => {
  const ids = await projectScopeIds(req.user);
  const items = await DtPeerReview.find(ids ? { project: { $in: ids } } : {}).populate(POP).sort({ updatedAt: -1 }).lean();
  res.json({ items: items.map((item) => ({ item, summary: summarize(item) })) });
});

export const get = handle(async (req, res) => respond(res, await loadPackage(req)));

export const create = handle(async (req, res) => {
  const project = req.body?.project;
  if (!mongoose.isValidObjectId(project) || !(await canReadProject(req.user, project))) throw fail(403, 'Project is not assigned to you.');
  const p = await Project.findById(project).select('services').lean();
  if (!p) throw fail(404, 'Project not found.');
  if (!eligible(p)) throw fail(400, 'Peer Review applies to Structural (STR) services only.');
  if (await DtPeerReview.exists({ project })) throw fail(409, 'This project already has a DT Peer Review package.');
  const doc = await DtPeerReview.create({
    project,
    location: text(req.body.location, 200), client: text(req.body.client, 200),
    principalConsultant: text(req.body.principalConsultant, 200), deliverableStage: text(req.body.deliverableStage, 60) || 'GFC',
    stages: DT_PR_STAGES.map((s) => ({ ...s })),
    checklist: DT_PR_CHECKLIST.map(([stage, item]) => ({ stage, item })),
    approvals: DT_PR_DELIVERABLES.map((deliverable) => ({ deliverable })),
    createdBy: req.user.id,
  });
  return respond(res, doc, 201);
});

export const updateHeader = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  for (const k of ['location', 'client', 'principalConsultant', 'deliverableStage']) if (k in (req.body ?? {})) doc[k] = text(req.body[k], 200);
  if (req.body?.team) {
    for (const r of DT_PR_TEAM_ROLES) {
      if (!(r.key in req.body.team)) continue;
      const v = req.body.team[r.key];
      if (v && (!mongoose.isValidObjectId(v) || !(await Employee.exists({ _id: v })))) throw fail(400, `Choose a valid ${r.label}.`);
      doc.team[r.key] = v || null;
    }
  }
  await doc.save();
  return respond(res, doc);
});

export const addChecklistItem = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const stage = text(req.body?.stage, 4), item = text(req.body?.item, 300);
  if (!DT_PR_STAGES.some((s) => s.code === stage) || !item) throw fail(400, 'Choose a stage and enter the checklist item.');
  if (doc.stages.find((s) => s.code === stage)?.signedOff?.at) throw fail(409, 'That stage is signed off.');
  doc.checklist.push({ stage, item });
  await doc.save();
  return respond(res, doc, 201);
});

export const updateChecklistItem = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const row = doc.checklist.id(req.params.itemId);
  if (!row) throw fail(404, 'Checklist item not found.');
  if (doc.stages.find((s) => s.code === row.stage)?.signedOff?.at) throw fail(409, 'That stage is signed off.');
  if ('status' in (req.body ?? {})) {
    if (!DT_PR_ITEM_STATUS.includes(req.body.status)) throw fail(400, 'Choose a valid status.');
    if (req.body.status !== row.status) {
      row.status = req.body.status;
      row.stamped = req.body.status === 'Not Started' ? { by: null, byName: '', at: null } : stampOf(await actor(req));
    }
  }
  if ('remarks' in (req.body ?? {})) row.remarks = text(req.body.remarks, 1000);
  await doc.save();
  return respond(res, doc);
});

export const updateApproval = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const row = doc.approvals.id(req.params.itemId);
  if (!row) throw fail(404, 'Deliverable not found.');
  if (!DT_PR_APPROVAL_STATUS.includes(req.body?.status)) throw fail(400, 'Choose a valid status.');
  const a = await actor(req);
  // Approval is the Principal Engineer's decision (or the Peer Review Head).
  if (req.body.status === 'Approved' && !(req.user.role === 'peer_review_head' || (a.employee && id(a.employee) === id(doc.team?.principal)))) {
    throw fail(403, 'Only the Principal Engineer can approve a deliverable.');
  }
  row.status = req.body.status;
  row.stamped = req.body.status === 'Pending' ? { by: null, byName: '', at: null } : stampOf(a);
  await doc.save();
  return respond(res, doc);
});

export const addComment = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const stage = text(req.body?.stage, 4), comment = text(req.body?.comment);
  if (!DT_PR_STAGES.some((s) => s.code === stage) || !comment) throw fail(400, 'Choose a stage and enter the comment.');
  if (doc.stages.find((s) => s.code === stage)?.signedOff?.at) throw fail(409, 'That stage is signed off.');
  doc.comments.push({
    stage, document: text(req.body.document, 200), topic: text(req.body.topic, 200), detail: text(req.body.detail, 200),
    rounds: [{ commentDate: date(req.body.commentDate) ?? new Date(), comment }],
  });
  await doc.save();
  return respond(res, doc, 201);
});

// One action per call: record the consultant's response to the latest round,
// or add DesignTree's next round (COMMENT IS OPEN / CLOSED) after a response.
export const addRound = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const c = doc.comments.id(req.params.commentId);
  if (!c) throw fail(404, 'Comment not found.');
  const last = c.rounds[c.rounds.length - 1];
  if (last?.verdict === 'Closed') throw fail(409, 'This comment is closed.');
  if (req.body?.kind === 'response') {
    const response = text(req.body.response);
    if (!response) throw fail(400, 'Enter the consultant response.');
    if (last.response) throw fail(409, 'This round already has a response. Add the DesignTree review first.');
    last.response = response; last.responseDate = date(req.body.responseDate) ?? new Date();
  } else if (req.body?.kind === 'review') {
    if (!['Open', 'Closed'].includes(req.body.verdict)) throw fail(400, 'Mark the comment Open or Closed.');
    if (!last.response) throw fail(409, 'Record the consultant response before the next DesignTree round.');
    const a = await actor(req);
    // Closing a comment is the Lead / Principal Engineer's call.
    if (req.body.verdict === 'Closed' && !(req.user.role === 'peer_review_head' || [doc.team?.lead, doc.team?.principal].some((t) => t && id(t) === id(a.employee)))) {
      throw fail(403, 'Only the Lead or Principal Engineer can close a comment.');
    }
    c.rounds.push({ commentDate: date(req.body.commentDate) ?? new Date(), verdict: req.body.verdict, comment: text(req.body.comment) });
  } else throw fail(400, 'Choose response or review.');
  await doc.save();
  return respond(res, doc, 201);
});

export const signOffStage = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const a = await actor(req);
  if (!a.employee || ![doc.team?.lead, doc.team?.principal].some((t) => t && id(t) === id(a.employee))) {
    throw fail(403, 'Only the Lead or Principal Engineer can sign off a stage.');
  }
  const s = summarize(doc.toObject()).stages.find((x) => x.code === req.params.code);
  if (!s) throw fail(404, 'Stage not found.');
  if (s.signedOff) throw fail(409, 'Stage already signed off.');
  if (!s.canSignOff) throw fail(409, 'A stage can be signed off only when all its checklist items are Verified or N.A. and it has no open comments.');
  doc.stages.find((x) => x.code === s.code).signedOff = stampOf(a);
  doc.markModified('stages');
  await doc.save();
  return respond(res, doc);
});

export const release = handle(async (req, res) => {
  const doc = await loadPackage(req, { write: true });
  const a = await actor(req);
  if (!a.employee || id(a.employee) !== id(doc.team?.principal)) throw fail(403, 'Only the Principal Engineer can mark the package Released for Issue.');
  const sum = summarize(doc.toObject());
  if (sum.blockers.length) throw fail(409, `Package is blocked: ${sum.blockers.join('; ')}.`);
  doc.released = stampOf(a);
  await doc.save();
  return respond(res, doc);
});
