import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// 06 Nov 2026: a TL extends a task's due date with a reason; the SPOC can mark
// a project Completed (final).
let f; const cookies = {};
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
before(async () => {
  f = await startLocalFixture();
  for (const [role, u] of Object.entries(f.cast)) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
    assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());

test('a TL extends a task due date with a reason, the history is kept and the assignee is told', async () => {
  const created = await call('tl', '/api/work/tasks', 'POST', { project: f.project, members: [f.cast.engineer.employee], stage: 'CD', deliverable: 'Soil retention', dueDate: day(2) });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.item._id, url = `/api/work/tasks/${id}/extend`;
  assert.equal((await call('tl', url, 'POST', { dueDate: day(5), reason: '' })).status, 400);
  assert.equal((await call('tl', url, 'POST', { dueDate: day(1), reason: 'Earlier is not an extension' })).status, 400);
  assert.equal((await call('outsider', url, 'POST', { dueDate: day(5), reason: 'Not a lead' })).status, 403);
  const ok = await call('tl', url, 'POST', { dueDate: day(5), reason: 'Client revised the soil report' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(String(ok.data.item.dueDate).slice(0, 10), day(5));
  const { Task } = await import('../api/src/models/Task.js');
  const task = await Task.findById(id).lean();
  assert.equal(task.dueDateHistory.length, 1);
  assert.equal(task.dueDateHistory[0].reason, 'Client revised the soil report');
  assert.equal(task.dueDateHistory[0].from.toISOString().slice(0, 10), day(2));
  await new Promise((r) => setTimeout(r, 300));
  const bell = await call('engineer', '/api/notifications');
  assert.ok(bell.data.items.some((n) => n.type === 'task-extended' && /Soil retention/.test(n.title)), 'extension alert');
  await Task.findByIdAndUpdate(id, { $set: { status: 'Approved' } });
  assert.equal((await call('tl', url, 'POST', { dueDate: day(9), reason: 'Too late' })).status, 409);
});

test('the SPOC marks a project Completed with a reason; it is final', async () => {
  const completed = await call('spoc', `/api/projects/${f.project}/hold`, 'PUT', { status: 'Completed', reason: 'All stages delivered' });
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  assert.equal(completed.data.project.status, 'Completed');
  assert.equal(completed.data.project.hold.history.at(-1).to, 'Completed');
  assert.equal((await call('spoc', `/api/projects/${f.project}/hold`, 'PUT', { status: 'Active', reason: 'Reopen' })).status, 409);
  assert.equal((await call('spoc', `/api/projects/${f.project}/hold`, 'PUT', { status: 'Completed', reason: '' })).status, 400);
});
