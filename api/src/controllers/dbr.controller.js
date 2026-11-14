// 13 Nov 2026: DBR (Design Basis Report) workflow — see models/Dbr.js.
import { z } from 'zod';
import { Dbr } from '../models/Dbr.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { SpocAllocation } from '../models/SpocAllocation.js';
import { canReadProject } from '../utils/projectScope.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { sendMail, mailLogLine } from '../services/mailer.js';
import { isSuperRole } from '../config/roles.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
export const DBR_LEAD_ROLES = ['team_lead', 'assoc_technical_director', 'technical_director', 'engineer_drafter'];
const REVIEW_ROLES = ['team_lead', 'assoc_technical_director', 'technical_director'];
const ACTOR = { coordinator: 'SPOC', team_lead: 'Team Lead', assoc_technical_director: 'ATD', technical_director: 'TD', engineer_drafter: 'Engineer' };
const actor = (role) => ACTOR[role] ?? 'Director';
const POP = [
  { path: 'project', select: 'name code jobNumber' },
  { path: 'engineer', select: 'firstName lastName empId designation' },
  { path: 'submittedBy reviewedBy forwardedBy sharedBy', select: 'name' },
  { path: 'log.by', select: 'name' },
];

const submitSchema = z.object({
  project: objectId,
  service: z.string().trim().max(40).optional(),
  title: z.string().trim().max(200).optional(),
  details: z.string().trim().min(1).max(10000),
  reference: z.string().trim().max(500).optional(),
  engineer: objectId.optional(),
}).strict();
const reviewSchema = z.object({ decision: z.enum(['Reviewed', 'Changes Required', 'Revised', 'Approved']), remarks: z.string().trim().max(2000).optional(), details: z.string().trim().max(10000).optional() }).strict();
const shareSchema = z.object({ clientEmail: z.string().trim().toLowerCase().email(), sharedAt: z.coerce.date().optional(), note: z.string().trim().max(2000).optional() }).strict();
const feedbackSchema = z.object({ clientStatus: z.enum(['Approved', 'Revision Required', 'Awaiting Response']), comments: z.string().trim().max(5000).optional() }).strict();

async function load(id) {
  return Dbr.findById(id).populate(POP).lean();
}
function push(doc, req, action, note) {
  doc.log = [...(doc.log ?? []), { action, note: note || undefined, actor: actor(req.user.role), by: req.user.id, at: new Date() }];
}
async function spocUsers(project) {
  const alloc = await SpocAllocation.find({ project, status: 'Approved' }).select('coordinator').lean();
  const p = await Project.findById(project).select('activation').lean();
  return userIdsForEmployees([...alloc.map((a) => a.coordinator), p?.activation?.spoc].filter(Boolean));
}
async function readable(req, res, project) {
  if (!await canReadProject(req.user, project)) { res.status(403).json({ message: 'Project is not assigned to you.' }); return false; }
  return true;
}

export async function listDbr(req, res, next) {
  try {
    const project = String(req.query.project ?? '');
    if (!/^[0-9a-fA-F]{24}$/.test(project)) return res.status(400).json({ message: 'Select a valid project.' });
    if (!await readable(req, res, project)) return undefined;
    const items = await Dbr.find({ project }).sort({ service: 1 }).populate(POP).lean();
    return res.json({ items });
  } catch (err) { return next(err); }
}

// Engineer / TL enters (or re-enters) the DBR details: goes to TL review.
export async function submitDbr(req, res, next) {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter the DBR details.' });
  try {
    const data = parsed.data;
    if (!await readable(req, res, data.project)) return undefined;
    const service = data.service || 'STR';
    let doc = await Dbr.findOne({ project: data.project, service });
    const resubmit = !!doc;
    if (doc && doc.status === 'Approved') return res.status(409).json({ message: 'This DBR is already approved by the client.' });
    if (!doc) doc = new Dbr({ project: data.project, service });
    const engineer = data.engineer ?? (req.user.role === 'engineer_drafter' ? (await User.findById(req.user.id).select('employee').lean())?.employee : undefined);
    Object.assign(doc, {
      title: data.title || doc.title,
      details: data.details,
      reference: data.reference ?? doc.reference,
      engineer: engineer ?? doc.engineer,
      submittedBy: req.user.id,
      submittedAt: new Date(),
      status: resubmit && ['Changes Required', 'Revision Required'].includes(doc.status) ? 'Revised' : 'Under TL Review',
    });
    push(doc, req, resubmit ? 'DBR details updated' : 'DBR details submitted');
    await doc.save();
    return res.status(resubmit ? 200 : 201).json({ item: await load(doc._id) });
  } catch (err) { return next(err); }
}

// TL review: Reviewed / Changes Required / Revised / Approved (internal).
export async function reviewDbr(req, res, next) {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid review.' });
  try {
    if (!REVIEW_ROLES.includes(req.user.role) && !isSuperRole(req.user.role)) return res.status(403).json({ message: 'Only the team lead reviews DBR details.' });
    const doc = await Dbr.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'DBR not found.' });
    if (!await readable(req, res, doc.project)) return undefined;
    if (doc.status === 'Approved') return res.status(409).json({ message: 'This DBR is already approved by the client.' });
    const { decision, remarks, details } = parsed.data;
    if (decision === 'Changes Required' && !remarks) return res.status(400).json({ message: 'Add remarks on the changes required.' });
    if (details) doc.details = details;
    doc.status = decision === 'Approved' ? 'Reviewed' : decision;
    doc.reviewRemarks = remarks || doc.reviewRemarks;
    doc.reviewedBy = req.user.id;
    doc.reviewedAt = new Date();
    if (decision === 'Revised') doc.revisionCount = (doc.revisionCount ?? 0) + 1;
    push(doc, req, decision === 'Approved' ? 'Approved by TL' : decision === 'Reviewed' ? 'Reviewed by TL — no changes' : decision === 'Revised' ? 'DBR revised' : 'Changes required by TL', remarks);
    await doc.save();
    return res.json({ item: await load(doc._id) });
  } catch (err) { return next(err); }
}

export async function forwardDbr(req, res, next) {
  try {
    if (!REVIEW_ROLES.includes(req.user.role) && !isSuperRole(req.user.role)) return res.status(403).json({ message: 'Only the team lead forwards the DBR to the SPOC.' });
    const doc = await Dbr.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'DBR not found.' });
    if (!await readable(req, res, doc.project)) return undefined;
    if (!['Reviewed', 'Revised'].includes(doc.status)) return res.status(409).json({ message: 'Review the DBR (Reviewed / Revised) before forwarding it to the SPOC.' });
    doc.status = 'Forwarded to SPOC';
    doc.forwardedAt = new Date();
    doc.forwardedBy = req.user.id;
    push(doc, req, 'Forwarded to SPOC');
    await doc.save();
    try {
      await notify({ users: await spocUsers(doc.project), project: doc.project, link: { view: 'project-detail', id: String(doc.project) }, title: `DBR (${doc.service}) received from the Team Lead`, detail: 'Share the DBR details with the client.', type: 'dbr' });
    } catch { /* best-effort */ }
    return res.json({ item: await load(doc._id) });
  } catch (err) { return next(err); }
}

// SPOC shares the DBR details with the client by email.
export async function shareDbr(req, res, next) {
  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid client email.' });
  try {
    if (req.user.role !== 'coordinator' && !isSuperRole(req.user.role)) return res.status(403).json({ message: 'Only the SPOC shares the DBR with the client.' });
    const doc = await Dbr.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'DBR not found.' });
    if (!await readable(req, res, doc.project)) return undefined;
    if (!['Forwarded to SPOC', 'Under Client Review'].includes(doc.status)) return res.status(409).json({ message: 'The Team Lead has not forwarded this DBR yet.' });
    const project = await Project.findById(doc.project).select('name code jobNumber').lean();
    const me = await User.findById(req.user.id).select('name email').lean();
    const projText = [project?.jobNumber || project?.code, project?.name].filter(Boolean).join(' · ');
    const result = await sendMail({
      to: [parsed.data.clientEmail],
      cc: [me?.email],
      subject: `DBR — ${doc.service} — ${projText}${doc.revisionCount ? ` (Revision ${doc.revisionCount})` : ''}`,
      text: [`Dear Sir / Madam,`, '', `Please find the Design Basis Report details for ${projText} (${doc.service}).`, '', doc.details ?? '', doc.reference ? `\nReference: ${doc.reference}` : '', parsed.data.note ? `\n${parsed.data.note}` : '', '', 'Kindly review and share your approval or comments.', '', `${me?.name ?? 'SPOC'}`, 'Design Tree Service Consultants'].join('\n'),
    });
    doc.clientEmail = parsed.data.clientEmail;
    doc.sharedAt = parsed.data.sharedAt ?? new Date();
    doc.sharedBy = req.user.id;
    doc.status = 'Under Client Review';
    doc.clientStatus = 'Awaiting Response';
    doc.emailLog = [...(doc.emailLog ?? []), mailLogLine(result, 'DBR shared with client')];
    push(doc, req, 'DBR details shared with Client by SPOC', parsed.data.note);
    await doc.save();
    return res.json({ item: await load(doc._id), email: result });
  } catch (err) { return next(err); }
}

// SPOC records the client feedback.
export async function dbrFeedback(req, res, next) {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid client feedback.' });
  try {
    if (req.user.role !== 'coordinator' && !isSuperRole(req.user.role)) return res.status(403).json({ message: 'Only the SPOC updates client feedback.' });
    const doc = await Dbr.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'DBR not found.' });
    if (!await readable(req, res, doc.project)) return undefined;
    if (!doc.sharedAt) return res.status(409).json({ message: 'Share the DBR with the client first.' });
    const { clientStatus, comments } = parsed.data;
    if (clientStatus === 'Revision Required' && !comments) return res.status(400).json({ message: 'Add the client comments for the revision.' });
    doc.clientStatus = clientStatus;
    doc.clientComments = comments || doc.clientComments;
    doc.clientRespondedAt = new Date();
    if (clientStatus === 'Approved') { doc.status = 'Approved'; doc.approvedAt = new Date(); }
    else if (clientStatus === 'Revision Required') doc.status = 'Revision Required';
    else doc.status = 'Under Client Review';
    push(doc, req, clientStatus === 'Approved' ? 'Client approved the DBR' : clientStatus === 'Revision Required' ? 'Client requires revision' : 'Awaiting client response', comments);
    await doc.save();
    if (clientStatus === 'Revision Required') {
      try {
        const leads = [doc.reviewedBy, doc.forwardedBy, doc.submittedBy].filter(Boolean).map(String);
        await notify({ users: [...new Set(leads)], project: doc.project, link: { view: 'project-detail', id: String(doc.project) }, title: `DBR (${doc.service}): client requires revision`, detail: (comments ?? '').slice(0, 120), type: 'dbr' });
      } catch { /* best-effort */ }
    }
    return res.json({ item: await load(doc._id) });
  } catch (err) { return next(err); }
}
