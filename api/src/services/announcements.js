import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { Announcement } from '../models/Announcement.js';
import { AnnouncementRecipient } from '../models/AnnouncementRecipient.js';
import { Notification } from '../models/Notification.js';
import { emitNotification } from '../realtime/io.js';
import { ANNOUNCEMENT_READERS, ANNOUNCEMENT_SENDERS } from '../config/announcements.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function announcementAudience() {
  const [branches, users] = await Promise.all([
    Branch.find({ isActive: true }).sort({ key: 1 }).lean(),
    User.find({ isActive: true, role: { $in: ANNOUNCEMENT_READERS } })
      .select('name employee role').populate('employee', 'branch status').sort({ _id: 1 }).lean(),
  ]);
  const byName = new Map(branches.map(b => [b.key, b]));
  const warnings = [];
  const recipients = users.filter(u => u.employee?.status !== 'Exited').map(u => {
    const raw = u.employee?.branch?.trim() ?? '';
    const branch = byName.get(raw.toLowerCase());
    const central = !u.employee && ANNOUNCEMENT_SENDERS.includes(u.role);
    const branchName = branch?.name ?? (raw ? `Unmapped: ${raw}` : central ? 'Central office' : 'Unassigned');
    if (!branch && !central) warnings.push({ user: String(u._id), name: u.name, issue: raw ? 'Branch is inactive or not in the branch master.' : 'No active branch assignment.' });
    return { user: u._id, name: u.name, branch: branch?._id ?? null, branchName };
  });
  const summary = branches.map(b => ({ branchName: b.name, count: 0 }));
  for (const r of recipients) {
    let entry = summary.find(b => b.branchName === r.branchName);
    if (!entry) { entry = { branchName: r.branchName, count: 0 }; summary.push(entry); }
    entry.count++;
  }
  return { recipients, summary, warnings, token: digest(recipients.map(r => [String(r.user), String(r.branch ?? ''), r.branchName])) };
}

// The announcement itself is the durable publication job. A lease and idempotent
// recipient/notification upserts recover interrupted work on standalone MongoDB.
export async function publishAnnouncement(id) {
  const owner = randomUUID();
  const now = new Date();
  const job = await Announcement.findOneAndUpdate({
    _id: id, status: 'pending',
    $and: [
      { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
      { $or: [{ retryAt: null }, { retryAt: { $lte: now } }] },
    ],
  }, { $set: { leaseOwner: owner, leaseUntil: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } }, { returnDocument: 'after' }).select('+recipients');
  if (!job) return;
  try {
    for (let i = 0; i < job.recipients.length; i += 250) {
      const leased = await Announcement.updateOne({ _id: id, leaseOwner: owner, status: 'pending' }, { $set: { leaseUntil: new Date(Date.now() + 60000) } });
      if (!leased.matchedCount) return;
      await AnnouncementRecipient.bulkWrite(job.recipients.slice(i, i + 250).map(r => ({ updateOne: {
        filter: { announcement: id, user: r.user },
        update: { $setOnInsert: { announcement: id, user: r.user, name: r.name, branch: r.branch, branchName: r.branchName } }, upsert: true,
      } })));
    }
    const notice = await Notification.findOneAndUpdate({ announcement: id }, { $setOnInsert: {
      // Generic event content is safe even for an old socket session. Reading the
      // actual notice always rechecks the current account and stored recipient.
      title: 'New company announcement', detail: 'Open Announcements to read the message.',
      users: job.recipients.map(r => r.user), roles: [], type: 'announcement',
      link: { view: 'announcement', id: String(id) },
    } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    const result = await Announcement.updateOne({ _id: id, leaseOwner: owner, status: 'pending' }, {
      $set: { status: 'published', publishedAt: new Date() },
      $unset: { leaseUntil: 1, leaseOwner: 1, retryAt: 1, lastError: 1 },
    });
    if (result.modifiedCount) emitNotification(notice);
  } catch (error) {
    await Announcement.updateOne({ _id: id, leaseOwner: owner }, {
      $set: { lastError: 'Publication interrupted. Automatic retry is pending.', retryAt: new Date(Date.now() + 10000) },
      $unset: { leaseUntil: 1, leaseOwner: 1 },
    });
    console.error('Announcement publication failed:', error.message);
  }
}

let workerStarted = false;
let running = false;
export function startAnnouncementWorker() {
  if (workerStarted) return;
  workerStarted = true;
  const tick = async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try {
      await Promise.all([Announcement.init(), AnnouncementRecipient.init(), Notification.init()]);
      const now = new Date();
      const jobs = await Announcement.find({ status: 'pending', $and: [
        { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
        { $or: [{ retryAt: null }, { retryAt: { $lte: now } }] },
      ] }).sort({ createdAt: 1 }).limit(10).select('_id').lean();
      for (const job of jobs) await publishAnnouncement(job._id);
    } catch (error) { if (mongoose.connection.readyState === 1) console.error('Announcement worker:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 3000);
  timer.unref();
  void tick();
}
