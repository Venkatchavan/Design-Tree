import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { User } from '../models/User.js';
import { Announcement } from '../models/Announcement.js';
import { AnnouncementRecipient } from '../models/AnnouncementRecipient.js';
import { Notification } from '../models/Notification.js';
import { ANNOUNCEMENT_READERS, ANNOUNCEMENT_SENDERS } from '../config/announcements.js';
import { announcementAudience, digest, publishAnnouncement } from '../services/announcements.js';

const router = Router();
const createSchema = z.object({
  title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(10000),
  requireAcknowledgment: z.boolean().default(false), requestId: z.string().uuid(),
  audienceToken: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.use(requireAuth);
// The current account takes precedence over stale role claims in a session.
router.use(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('name role isActive employee').populate('employee', 'status');
    if (!user?.isActive || !ANNOUNCEMENT_READERS.includes(user.role) || user.employee?.status === 'Exited') return res.status(403).json({ message: 'Announcements are available to active internal staff only.' });
    req.announcementUser = user;
    return next();
  } catch (e) { return next(e); }
});
const sender = (req, res, next) => ANNOUNCEMENT_SENDERS.includes(req.announcementUser.role)
  ? next() : res.status(403).json({ message: 'Only Admin and Directors can send announcements or view reports.' });
const validId = (req, res, next) => /^[a-f\d]{24}$/i.test(req.params.id)
  ? next() : res.status(400).json({ message: 'Invalid announcement.' });
function publicItem(doc, receipt) {
  return { id: String(doc._id), title: doc.title, body: doc.body, authorName: doc.authorName,
    author: String(doc.author), status: doc.status, createdAt: doc.createdAt, publishedAt: doc.publishedAt,
    requireAcknowledgment: doc.requireAcknowledgment, recipientCount: doc.recipientCount,
    readAt: receipt?.readAt ?? null, acknowledgedAt: receipt?.acknowledgedAt ?? null,
    lastError: doc.lastError };
}
async function access(req, res) {
  const doc = await Announcement.findById(req.params.id);
  const receipt = doc?.status === 'published' ? await AnnouncementRecipient.findOne({ announcement: doc._id, user: req.announcementUser._id }) : null;
  if (!doc || (!receipt && String(doc.author) !== String(req.announcementUser._id))) { res.status(404).json({ message: 'Announcement not found.' }); return null; }
  return { doc, receipt };
}
router.get('/capabilities', wrap(async (req, res) => res.json({ canSend: ANNOUNCEMENT_SENDERS.includes(req.announcementUser.role) })));
router.post('/preview', sender, wrap(async (_req, res) => {
  const a = await announcementAudience();
  res.json({ recipientCount: a.recipients.length, branches: a.summary, warnings: a.warnings, audienceToken: a.token });
}));
router.post('/', sender, wrap(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a title and message, then preview the audience before sending.' });
  const data = parsed.data;
  const hash = digest([data.title, data.body, data.requireAcknowledgment]);
  await Promise.all([Announcement.init(), AnnouncementRecipient.init(), Notification.init()]);
  let doc = await Announcement.findOne({ author: req.announcementUser._id, requestId: data.requestId });
  if (doc && doc.contentHash !== hash) return res.status(409).json({ message: 'This send request already has different content. Start a new message.' });
  if (!doc) {
    const a = await announcementAudience();
    if (!a.recipients.length || a.recipients.length > 20000) return res.status(400).json({ message: 'The audience must contain between 1 and 20000 staff accounts.' });
    if (a.token !== data.audienceToken) return res.status(409).json({ message: 'The audience changed. Preview it again before sending.' });
    try {
      doc = await Announcement.create({ author: req.announcementUser._id, authorName: req.announcementUser.name,
        requestId: data.requestId, contentHash: hash, title: data.title, body: data.body,
        requireAcknowledgment: data.requireAcknowledgment, recipients: a.recipients,
        recipientCount: a.recipients.length, branchSummary: a.summary });
    } catch (e) {
      if (e.code !== 11000) throw e;
      doc = await Announcement.findOne({ author: req.announcementUser._id, requestId: data.requestId });
      if (doc.contentHash !== hash) return res.status(409).json({ message: 'This send request already has different content.' });
    }
  }
  // Durable acceptance, followed by a best-effort immediate attempt. The worker
  // resumes this same job after a crash, without requiring another Send click.
  void publishAnnouncement(doc._id).catch(e => console.error('Announcement dispatch:', e.message));
  return res.status(doc.status === 'published' ? 200 : 202).json({ item: publicItem(doc) });
}));
router.get('/unread-count', wrap(async (req, res) => {
  const result = await AnnouncementRecipient.aggregate([
    { $match: { user: req.announcementUser._id, readAt: null } },
    { $lookup: { from: Announcement.collection.name, localField: 'announcement', foreignField: '_id', as: 'notice' } },
    { $match: { 'notice.status': 'published' } }, { $count: 'count' },
  ]);
  res.json({ unread: result[0]?.count ?? 0 });
}));
router.get('/', wrap(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Invalid page.' });
  const sent = req.query.folder === 'sent';
  if (sent && !ANNOUNCEMENT_SENDERS.includes(req.announcementUser.role)) return res.status(403).json({ message: 'Sender access required.' });
  const receipts = sent ? [] : await AnnouncementRecipient.find({ user: req.announcementUser._id, ...(req.query.folder === 'unread' ? { readAt: null } : {}) }).lean();
  const filter = sent ? { author: req.announcementUser._id } : { _id: { $in: receipts.map(r => r.announcement) }, status: 'published' };
  const [docs, total] = await Promise.all([Announcement.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20), Announcement.countDocuments(filter)]);
  const byId = new Map(receipts.map(r => [String(r.announcement), r]));
  res.json({ items: docs.map(d => publicItem(d, byId.get(String(d._id)))), page, total, pageSize: 20 });
}));
router.get('/:id', validId, wrap(async (req, res) => { const result = await access(req, res); if (result) res.json({ item: publicItem(result.doc, result.receipt) }); }));
for (const action of ['read', 'acknowledge']) router.post(`/:id/${action}`, validId, wrap(async (req, res) => {
  if (Object.keys(req.body ?? {}).length) return res.status(400).json({ message: 'The signed-in account supplies the reader identity.' });
  const result = await access(req, res);
  if (!result) return;
  const { doc, receipt } = result;
  if (!receipt) return res.status(409).json({ message: 'This announcement is not published for this account.' });
  if (action === 'acknowledge' && !doc.requireAcknowledgment) return res.status(409).json({ message: 'This announcement does not request acknowledgment.' });
  const now = new Date();
  await AnnouncementRecipient.updateOne({ _id: receipt._id, readAt: null }, { $set: { readAt: now } });
  if (action === 'acknowledge') await AnnouncementRecipient.updateOne({ _id: receipt._id, acknowledgedAt: null }, { $set: { acknowledgedAt: now } });
  await Notification.updateOne({ announcement: doc._id }, { $addToSet: { readBy: req.announcementUser._id } });
  const current = await AnnouncementRecipient.findById(receipt._id);
  res.json({ item: publicItem(doc, current) });
}));
router.get('/:id/report', sender, validId, wrap(async (req, res) => {
  const doc = await Announcement.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Announcement not found.' });
  const receipts = doc.status === 'published' ? await AnnouncementRecipient.find({ announcement: doc._id }).sort({ branchName: 1, name: 1 }).lean() : [];
  const branches = doc.branchSummary.map(s => {
    const group = receipts.filter(r => r.branchName === s.branchName);
    return { branchName: s.branchName, recipients: s.count, opened: group.filter(r => r.readAt).length, acknowledged: group.filter(r => r.acknowledgedAt).length };
  });
  res.json({ item: publicItem(doc), branches, recipients: receipts.map(r => ({ user: String(r.user), name: r.name, branchName: r.branchName, readAt: r.readAt, acknowledgedAt: r.acknowledgedAt })) });
}));
export default router;
