import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// 07 Nov 2026: the Team Lead (and HR) must give a reason to approve a leave request as
// well as to reject it, and the decision is recorded with who, when and why.
let f; const cookies = {};
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  f = await startLocalFixture();
  // The fixture has no HR login: use the marketing login as HR.
  await f.models.User.updateOne({ _id: f.cast.marketing.user }, { role: 'hr' });
  f.cast.hr = f.cast.marketing;
  for (const role of ['engineer', 'tl', 'hr', 'outsider']) {
    const u = f.cast[role];
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
    assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());

const L = '/api/leave-travel';
const leave = { leaveType: 'Casual Leave', from: '2026-12-01', to: '2026-12-02', reason: 'Family function' };

test('approving or rejecting a leave needs a reason, and the decision is recorded', async () => {
  const mk = async () => (await call('engineer', `${L}/leave`, 'POST', leave)).data.item;
  const a = await mk();
  assert.deepEqual(a.flowStages, ['tl', 'hr']);
  // The TL of the engineer's team sees it in the approval queue.
  const queue = await call('tl', `${L}/approvals/queue`);
  assert.equal(queue.status, 200);
  assert.ok(queue.data.leave.some(x => x._id === a._id), 'TL sees the request');

  for (const status of ['Approved', 'Rejected']) {
    assert.equal((await call('tl', `${L}/leave/${a._id}/decision`, 'PATCH', { status })).status, 400, status);
    assert.equal((await call('tl', `${L}/leave/${a._id}/decision`, 'PATCH', { status, remarks: '  ' })).status, 400, status);
  }
  const ok = await call('tl', `${L}/leave/${a._id}/decision`, 'PATCH', { status: 'Approved', remarks: 'Handover done, approved' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.item.stages.tl.status, 'Approved');
  assert.equal(ok.data.item.stages.tl.remarks, 'Handover done, approved');
  assert.equal(String(ok.data.item.stages.tl.by), f.cast.tl.user);
  assert.ok(ok.data.item.stages.tl.at);
  assert.equal(ok.data.item.status, 'Pending HR');

  // HR stage: same rule.
  assert.equal((await call('hr', `${L}/leave/${a._id}/decision`, 'PATCH', { status: 'Approved' })).status, 400);
  const done = await call('hr', `${L}/leave/${a._id}/decision`, 'PATCH', { status: 'Approved', remarks: 'Balance available' });
  assert.equal(done.status, 200); assert.equal(done.data.item.status, 'Approved');

  const b = await mk();
  const no = await call('tl', `${L}/leave/${b._id}/decision`, 'PATCH', { status: 'Rejected', remarks: 'Release week, please reschedule' });
  assert.equal(no.status, 200); assert.equal(no.data.item.status, 'Rejected');
  assert.equal(no.data.item.stages.tl.remarks, 'Release week, please reschedule');
});

test('the Team Lead is told about a new leave request', async () => {
  const { Notification } = await import('../api/src/models/Notification.js');
  const notes = await Notification.find({ type: 'leave' }).lean();
  assert.ok(notes.some(n => /Leave request/.test(n.title) && (n.users ?? []).map(String).includes(f.cast.tl.user)));
});
