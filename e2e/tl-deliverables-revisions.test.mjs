import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// 11 Nov 2026 client feedback: deliverables list + team-wide log, revision
// resubmission by the assigned member only, TL-only drawing status, and the
// extra-hours reason counting hours already logged that day.
let f; const cookies = {};
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function login(role) {
  const u = f.cast[role];
  const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
  assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
}
before(async () => { f = await startLocalFixture(); for (const role of ['tl', 'engineer', 'td']) await login(role); });
after(async () => f?.stop());

test('deliverable add / change / remove are logged and readable by the whole team', async () => {
  const created = await call('tl', '/api/work/deliverables', 'POST', { project: f.project, deliverable: 'Preliminary framing plan', stage: 'Concept', status: 'Planned' });
  assert.equal(created.status, 201);
  const id = created.data.item._id;
  const upd = await call('tl', `/api/work/deliverables/${id}`, 'PUT', { project: f.project, deliverable: 'Preliminary framing plan', stage: 'Concept', assignedTo: f.cast.engineer.employee, status: 'In Progress' });
  assert.equal(upd.status, 200);
  // A revised date needs its reason.
  const noReason = await call('tl', `/api/work/deliverables/${id}`, 'PUT', { revisedDate: '2026-12-01' });
  assert.equal(noReason.status, 400);
  assert.match(noReason.data.message, /reason for the revised date/);
  const revised = await call('tl', `/api/work/deliverables/${id}`, 'PUT', { revisedDate: '2026-12-01', revisedReason: 'Architect drawings delayed' });
  assert.equal(revised.status, 200);
  assert.equal(revised.data.item.revisedReason, 'Architect drawings delayed');
  assert.equal((await call('tl', '/api/work/deliverables', 'POST', { project: f.project, deliverable: 'Budgetary estimate', stage: 'Concept', revisedDate: '2026-12-01' })).status, 400);
  const del = await call('tl', `/api/work/deliverables/${id}`, 'DELETE');
  assert.equal(del.status, 200);

  const log = await call('engineer', `/api/work/deliverables-log?project=${f.project}`);
  assert.equal(log.status, 200);
  const actions = log.data.items.map(l => l.action).sort();
  assert.deepEqual(actions, ['Changed', 'Created', 'Removed', 'Revised']);
  const rev = log.data.items.find(l => l.action === 'Revised');
  assert.match(rev.details, /revised date: — → 2026-12-01/);
  assert.match(rev.details, /reason: — → Architect drawings delayed/);
  assert.equal(String(rev.revisedDate).slice(0, 10), '2026-12-01');
  assert.equal(rev.reason, 'Architect drawings delayed');
  const changed = log.data.items.find(l => l.action === 'Changed');
  assert.match(changed.details, /status: Planned → In Progress/);
  assert.match(changed.details, /assignee: — → Test engineer Workflow/);
  assert.ok(changed.by, 'log shows who made the change');

  assert.equal((await call('engineer', `/api/work/deliverables?project=${f.project}`)).status, 200);
  assert.equal((await call('engineer', '/api/work/deliverables', 'POST', { project: f.project, deliverable: 'x' })).status, 403);
});

test('revision flow: lead allots, member resubmits, lead approves or sends back with instructions', async () => {
  const rev = await call('tl', '/api/work/revisions', 'POST', { project: f.project, stage: 'Concept', details: 'Column grid changed', assignedTo: f.cast.engineer.employee });
  assert.equal(rev.status, 201);
  const id = rev.data.item._id;
  const set = (role, status, note) => call(role, `/api/work/revisions/${id}/status`, 'PATCH', note ? { status, note } : { status });

  // Only the allotted member can resubmit; the lead cannot, and cannot act before the member has.
  assert.equal((await set('tl', 'Resubmitted')).status, 403);
  assert.equal((await set('td', 'Resubmitted')).status, 403);
  assert.equal((await set('tl', 'Cleared')).status, 409);
  assert.equal((await set('engineer', 'Cleared')).status, 403);
  assert.equal((await set('engineer', 'Resubmitted')).status, 200);
  assert.equal((await set('engineer', 'Resubmitted')).status, 409);

  // Lead sends it back: instructions are required and reach the member.
  assert.equal((await set('tl', 'Revise')).status, 400);
  assert.equal((await set('engineer', 'Revise', 'x')).status, 403);
  const back = await set('tl', 'Revise', 'Increase the beam depth to 600');
  assert.equal(back.status, 200);
  assert.equal(back.data.item.status, 'Revise');
  assert.equal(back.data.item.leadNote, 'Increase the beam depth to 600');
  const mine = await call('engineer', '/api/work/revisions/mine');
  assert.equal(mine.data.items.find(r => r._id === id).leadNote, 'Increase the beam depth to 600');

  // Member revises and resubmits again; lead approves.
  assert.equal((await set('engineer', 'Resubmitted')).status, 200);
  const approved = await set('tl', 'Cleared');
  assert.equal(approved.status, 200);
  assert.equal(approved.data.item.status, 'Cleared');
  assert.equal((await set('tl', 'Revise', 'again')).status, 409);
  assert.deepEqual(approved.data.item.reviewLog.map(l => l.action), ['Resubmitted', 'Revise', 'Resubmitted', 'Approved']);

  // The lead who logged it hears when it is resubmitted; the member hears when it is sent back.
  const { Notification } = await import('../api/src/models/Notification.js');
  const notes = await Notification.find({ 'link.id': id }).lean();
  assert.ok(notes.some(n => /resubmitted/.test(n.title) && n.users.map(String).includes(f.cast.tl.user)));
  assert.ok(notes.some(n => /needs revision/.test(n.title) && n.users.map(String).includes(f.cast.engineer.user) && /beam depth/.test(n.detail)));
});

test('drawing status Revise / Resubmit / Approved is set by the team lead only', async () => {
  const d = await call('tl', '/api/work/drawings', 'POST', { project: f.project, drawingNo: 'S-302', title: 'Column layout', rev: 'R01' });
  assert.equal(d.status, 201);
  const id = d.data.item._id;
  for (const status of ['Revise', 'Resubmit', 'Approved']) {
    const r = await call('tl', `/api/work/drawings/${id}`, 'PUT', { status });
    assert.equal(r.status, 200); assert.equal(r.data.item.status, status);
  }
  assert.equal((await call('tl', `/api/work/drawings/${id}`, 'PUT', { status: 'Done' })).status, 400);
  assert.equal((await call('td', `/api/work/drawings/${id}`, 'PUT', { status: 'Revise' })).status, 403);
  assert.equal((await call('engineer', '/api/work/drawings', 'POST', { project: f.project, drawingNo: 'S-303', title: 'x', status: 'Approved' })).status, 403);
  // Editing other fields is unaffected for the lead.
  assert.equal((await call('tl', `/api/work/drawings/${id}`, 'PUT', { title: 'Column layout rev' })).status, 200);
});

test('extra-hours reason is required once the day total, including earlier entries, passes 8h', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const first = await call('engineer', '/api/work-entries', 'POST', { project: f.project, date: day, hours: 6, category: 'Hourly', taskActivity: 'a' });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const blocked = await call('engineer', '/api/work-entries', 'POST', { project: f.project, date: day, hours: 3, category: 'Hourly', taskActivity: 'b' });
  assert.equal(blocked.status, 400);
  assert.match(blocked.data.message, /reason is required for extra hours/);
  const allowed = await call('engineer', '/api/work-entries', 'POST', { project: f.project, date: day, hours: 3, category: 'Hourly', taskActivity: 'b', extraHoursReason: 'Client deadline' });
  assert.equal(allowed.status, 201, JSON.stringify(allowed.data));
  // The form reads the day's hours from this list.
  const mine = await call('engineer', '/api/work-entries?mine=true');
  const total = mine.data.items.filter(e => String(e.date).slice(0, 10) === day).reduce((s, e) => s + e.hours, 0);
  assert.equal(total, 9);
});
