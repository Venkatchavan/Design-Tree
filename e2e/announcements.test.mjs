import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { startLocalFixture } from './local-fixture.mjs';
import { io } from '../web/node_modules/socket.io-client/build/esm-debug/index.js';

let f, Announcement, Receipt, Notification, publishAnnouncement;
const cookies = {};
async function call(role, path, method = 'GET', body) {
  const res = await fetch(f.base + '/api/announcements' + path, {
    method, headers: { ...(role ? { Cookie: cookies[role] } : {}), 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}
async function waitPublished(id) {
  for (let n = 0; n < 100; n++) {
    const doc = await Announcement.findById(id);
    if (doc.status === 'published') return doc;
    await delay(100);
  }
  assert.fail('Publication did not complete.');
}
async function message(role = 'admin', extra = {}) {
  const preview = await call(role, '/preview', 'POST', {});
  assert.equal(preview.status, 200);
  const body = { title: 'Branch coordination notice', body: 'All offices: coordination starts at 10 AM.', requestId: randomUUID(), audienceToken: preview.data.audienceToken, requireAcknowledgment: true, ...extra };
  const result = await call(role, '', 'POST', body);
  assert([200, 202].includes(result.status), JSON.stringify(result));
  await waitPublished(result.data.item.id);
  return { id: result.data.item.id, body };
}
before(async () => {
  f = await startLocalFixture();
  assert(f.isolated && f.base.startsWith('http://127.0.0.1:'));
  ({ Announcement } = await import('../api/src/models/Announcement.js'));
  ({ AnnouncementRecipient: Receipt } = await import('../api/src/models/AnnouncementRecipient.js'));
  ({ Notification } = await import('../api/src/models/Notification.js'));
  ({ publishAnnouncement } = await import('../api/src/services/announcements.js'));
  const admin = await f.models.User.findById(f.cast.admin.user).select('+passwordHash');
  for (const [key, role] of Object.entries({ working: 'working_director', executive: 'executive_director', client: 'client', architect: 'architect', superuser: 'superuser', newStaff: 'engineer_drafter' })) {
    const user = await f.models.User.create({ name: 'Test ' + key, email: `${key}@announcement-test.example`, passwordHash: admin.passwordHash, role });
    f.cast[key] = { user: String(user._id), email: user.email, role };
  }
  await f.models.Branch.create({ name: 'Test Branch B' });
  await f.models.Branch.create({ name: 'Empty branch' });
  await f.models.Employee.updateOne({ _id: f.cast.outsider.employee }, { branch: 'Test Branch B' });
  for (const [key, user] of Object.entries(f.cast)) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: f.password }) });
    assert.equal(r.status, 200, 'Login ' + key);
    cookies[key] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => { await f?.stop(); });

test('announcement menu and detail route are available to internal staff only', async () => {
  const { ROLE_KEYS, navFor, canAccess } = await import('../api/src/config/roles.js');
  for (const role of ROLE_KEYS) {
    const permitted = !['client', 'architect', 'superuser'].includes(role);
    assert.equal(navFor(role).some(n => n.view === 'announcements'), permitted, role);
    assert.equal(canAccess(role, 'announcement-detail'), permitted, role);
  }
});

test('seven sender roles can publish; other staff have read-only access', async () => {
  for (const role of ['admin', 'md', 'working', 'executive', 'associate', 'td', 'atd']) {
    assert.equal((await call(role, '/capabilities')).data.canSend, true);
    await message(role);
  }
  for (const role of ['engineer', 'spoc', 'tl', 'dmh', 'finance', 'qs']) {
    assert.equal((await call(role, '/capabilities')).data.canSend, false);
    assert.equal((await call(role, '/preview', 'POST', {})).status, 403);
    assert.equal((await call(role, '', 'POST', {})).status, 403);
    assert.equal((await call(role, '?folder=sent')).status, 403);
  }
  assert.equal((await call(null, '')).status, 401);
});

test('all branches receive saved notices; preview exposes empty and unassigned audiences', async () => {
  const preview = await call('admin', '/preview', 'POST', {});
  assert(preview.data.branches.some(b => b.branchName === 'Test HQ' && b.count > 0));
  assert(preview.data.branches.some(b => b.branchName === 'Test Branch B' && b.count === 1));
  assert(preview.data.branches.some(b => b.branchName === 'Empty branch' && b.count === 0));
  assert(preview.data.branches.some(b => b.branchName === 'Central office' && b.count === 2));
  assert(preview.data.warnings.some(w => w.user === f.cast.newStaff.user));
  const { id } = await message();
  for (const role of ['engineer', 'outsider', 'newStaff', 'working']) assert.equal((await call(role, '/' + id)).status, 200);
  const report = await call('md', `/${id}/report`);
  assert.equal(report.data.recipients.length, preview.data.recipientCount);
  assert.equal((await call('engineer', `/${id}/report`)).status, 403);
  for (const role of ['client', 'architect', 'superuser']) {
    for (const path of ['', '/' + id, '/unread-count', `/${id}/report`]) assert.equal((await call(role, path)).status, 403);
    assert.equal(await Receipt.countDocuments({ announcement: id, user: f.cast[role].user }), 0);
  }
});

test('current role, inactive account and exited employee override stale session claims', async () => {
  await f.models.User.updateOne({ _id: f.cast.td.user }, { role: 'engineer_drafter' });
  assert.equal((await call('td', '/preview', 'POST', {})).status, 403);
  await f.models.User.updateOne({ _id: f.cast.td.user }, { role: 'technical_director', isActive: false });
  assert.equal((await call('td', '')).status, 403);
  await f.models.User.updateOne({ _id: f.cast.td.user }, { isActive: true });
  await f.models.Employee.updateOne({ _id: f.cast.outsider.employee }, { status: 'Exited' });
  assert.equal((await call('outsider', '')).status, 403);
  const { id } = await message();
  assert.equal(await Receipt.countDocuments({ announcement: id, user: f.cast.outsider.user }), 0);
  await f.models.Employee.updateOne({ _id: f.cast.outsider.employee }, { status: 'Active' });
});

test('preview drift, invalid input and duplicate send requests are handled safely', async () => {
  const p = (await call('admin', '/preview', 'POST', {})).data;
  const body = { title: 'Stable notice', body: '<script>This is plain text.</script>', requestId: randomUUID(), audienceToken: p.audienceToken };
  await f.models.User.updateOne({ _id: f.cast.newStaff.user }, { isActive: false });
  assert.equal((await call('admin', '', 'POST', body)).status, 409);
  await f.models.User.updateOne({ _id: f.cast.newStaff.user }, { isActive: true });
  body.audienceToken = (await call('admin', '/preview', 'POST', {})).data.audienceToken;
  const results = await Promise.all([call('admin', '', 'POST', body), call('admin', '', 'POST', body)]);
  assert(results.every(r => [200, 202].includes(r.status)), JSON.stringify(results));
  assert.equal(results[0].data.item.id, results[1].data.item.id);
  const id = results[0].data.item.id;
  await waitPublished(id);
  assert.equal(await Announcement.countDocuments({ author: f.cast.admin.user, requestId: body.requestId }), 1);
  assert.equal(await Notification.countDocuments({ announcement: id }), 1);
  const doc = await Announcement.findById(id);
  assert.equal(await Receipt.countDocuments({ announcement: id }), doc.recipientCount);
  assert.equal((await call('admin', '', 'POST', { ...body, body: 'Different content' })).status, 409);
  assert.equal((await call('admin', '', 'POST', { ...body, title: ' ', requestId: randomUUID() })).status, 400);
  assert.equal((await call('engineer', '/bad-id')).status, 400);
  assert.equal((await call('engineer', '?page=-1')).status, 400);
  assert.equal((await call('engineer', '/' + 'a'.repeat(24))).status, 404);
});

test('read and acknowledgment are personal, idempotent and branch snapshots survive transfers', async () => {
  const { id } = await message();
  assert.equal((await call('engineer', `/${id}/read`, 'POST', { user: f.cast.outsider.user })).status, 400);
  const first = await call('engineer', `/${id}/read`, 'POST', {});
  assert(first.data.item.readAt);
  assert.equal((await call('engineer', `/${id}/read`, 'POST', {})).data.item.readAt, first.data.item.readAt);
  assert.equal((await call('outsider', '/' + id)).data.item.readAt, null);
  const ack = await call('engineer', `/${id}/acknowledge`, 'POST', {});
  assert(ack.data.item.acknowledgedAt);
  assert.equal((await call('engineer', `/${id}/acknowledge`, 'POST', {})).data.item.acknowledgedAt, ack.data.item.acknowledgedAt);
  await f.models.Employee.updateOne({ _id: f.cast.engineer.employee }, { branch: 'Test Branch B' });
  const report = (await call('admin', `/${id}/report`)).data;
  assert.equal(report.recipients.find(r => r.user === f.cast.engineer.user).branchName, 'Test HQ');
  const noAck = await message('admin', { requireAcknowledgment: false });
  assert.equal((await call('engineer', `/${noAck.id}/acknowledge`, 'POST', {})).status, 409);
  const newcomer = await f.models.User.create({ name: 'Joined later', email: 'later@announcement-test.example', passwordHash: 'unused', role: 'engineer_drafter' });
  assert.equal(await Receipt.countDocuments({ user: newcomer._id, announcement: id }), 0);
});

test('publication resumes an interrupted durable job without duplicate recipients', async () => {
  const { id } = await message();
  const source = await Announcement.findById(id).select('+recipients').lean();
  const job = await Announcement.create({ ...source, _id: undefined, requestId: randomUUID(), status: 'pending', publishedAt: undefined, leaseUntil: new Date(Date.now() - 5000), leaseOwner: 'stopped-process' });
  await Receipt.create({ announcement: job._id, ...source.recipients[0] });
  // Let the running worker discover the expired lease without another Send.
  await waitPublished(job._id);
  assert.equal((await Announcement.findById(job._id)).status, 'published');
  assert.equal(await Receipt.countDocuments({ announcement: job._id }), source.recipientCount);
  await publishAnnouncement(job._id);
  assert.equal(await Notification.countDocuments({ announcement: job._id }), 1);
});

test('unread totals and paginated history include more than 40 saved notices', async () => {
  const source = await Announcement.findOne({ status: 'published' }).select('+recipients').lean();
  const jobs = await Announcement.insertMany(Array.from({ length: 45 }, (_, i) => ({ ...source, _id: undefined, requestId: randomUUID(), title: 'History ' + i, status: 'published' })));
  await Receipt.insertMany(jobs.map(j => ({ announcement: j._id, user: f.cast.engineer.user, name: 'Engineer', branchName: 'Test Branch B' })));
  const count = (await call('engineer', '/unread-count')).data.unread;
  assert(count >= 45);
  const page1 = (await call('engineer', '?folder=unread&page=1')).data;
  const page3 = (await call('engineer', '?folder=unread&page=3')).data;
  assert.equal(page1.items.length, 20); assert(page3.items.length > 0); assert(page1.total >= 45);
  assert(!page3.items.some(i => page1.items.some(j => i.id === j.id)));
});

test('live event reaches staff in two branches and reconnect recovers missed content', async () => {
  const connect = key => new Promise((resolve, reject) => {
    const s = io(f.base, { extraHeaders: { Cookie: cookies[key] }, transports: ['websocket'], reconnection: false });
    s.once('connect', () => resolve(s)); s.once('connect_error', reject);
  });
  const sockets = await Promise.all(['engineer', 'outsider', 'client'].map(connect));
  try {
    const events = sockets.map(() => []);
    sockets.forEach((s, i) => s.on('notification', n => events[i].push(n)));
    const { id } = await message();
    await delay(150);
    for (const i of [0, 1]) assert(events[i].some(e => e.link?.id === id && e.link.view === 'announcement'));
    assert(!events[2].some(e => e.link?.id === id));
    sockets[0].disconnect();
    const missed = await message();
    assert.equal((await call('engineer', '/' + missed.id)).status, 200);
    assert.equal((await call('engineer', '/' + missed.id)).data.item.readAt, null);
  } finally { sockets.forEach(s => s.disconnect()); }
});
