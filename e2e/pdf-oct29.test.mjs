import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

let f;
const cookies = {};
before(async () => {
  f = await startLocalFixture();
  for (const role of ['tl', 'td', 'atd', 'associate', 'admin']) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.cast[role].email, password: f.password }) });
    cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
  await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee, { director: f.cast.atd.employee });
  await f.models.Employee.findByIdAndUpdate(f.cast.engineer.employee, { reportingManager: f.cast.tl.employee });
  const { WorkEntry } = await import('../api/src/models/WorkEntry.js');
  f.models.WorkEntry = WorkEntry;
  await WorkEntry.create({ refNo: 'ATD-AUTHORIZED', employee: f.cast.engineer.employee, project: f.project, date: new Date(), hours: 2 });
  await WorkEntry.create({ refNo: 'ATD-OTHER-SERVICE', employee: f.cast.outsider.employee, project: f.project, date: new Date(), hours: 3 });
  await f.models.Team.create({ name: 'Other Electrical service on same project', service: 'ELE', projects: [f.project], lead: f.cast.outsider.employee, members: [{ employee: f.cast.outsider.employee }] });
});
after(async () => { await f?.stop(); });
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}

test('Structural TL roster excludes other services on the same project', async () => {
  const r = await call('tl', '/api/work/tasks/assignees?project=' + f.project);
  assert.equal(r.status, 200);
  assert(r.data.items.some(m => m.employee._id === f.cast.engineer.employee));
  assert(!r.data.items.some(m => m.employee._id === f.cast.outsider.employee));
  assert(!r.data.items.some(m => m.service === 'ELE' || m.service === 'Peer Review'));
});
test('TL cannot assign an unrelated service employee by bypassing the picker', async () => {
  const r = await call('tl', '/api/work/tasks', 'POST', { project: f.project, members: [f.cast.outsider.employee], deliverable: 'Cross-service task' });
  assert.equal(r.status, 400);
});
test('TL cannot change an existing task to an unrelated service employee', async () => {
  const created = await call('tl', '/api/work/tasks', 'POST', { project: f.project, members: [f.cast.engineer.employee], deliverable: 'Structural task' });
  assert.equal(created.status, 201);
  const changed = await call('tl', '/api/work/tasks/' + created.data.item._id, 'PUT', { members: [f.cast.outsider.employee] });
  assert.equal(changed.status, 400);
});
test('saved sibling Structural roster remains available when the TL team has no members', async () => {
  await f.models.Team.updateMany({ lead: f.cast.tl.employee }, { $set: { members: [] } });
  await f.models.Team.create({ name: 'Confirmed Structural delivery roster', service: 'Structural', projects: [f.project], members: [{ employee: f.cast.engineer.employee }] });
  const r = await call('tl', '/api/work/tasks/assignees?project=' + f.project);
  assert(r.data.items.some(m => m.employee._id === f.cast.engineer.employee));
  assert(!r.data.items.some(m => m.employee._id === f.cast.outsider.employee));
});
test('TD and ATD bootstrap exposes one My Team navigation entry without duplicate Teams', async () => {
  for (const role of ['td', 'atd']) {
    const r = await call(role, '/api/meta/bootstrap');
    assert.equal(r.status, 200);
    assert.equal(r.data.nav.filter(n => n.view === 'my-team').length, 1);
    assert.equal(r.data.nav.filter(n => n.view === 'teams').length, 0);
  }
});
test('AD and Admin retain their separate Teams navigation', async () => {
  for (const role of ['associate', 'admin']) {
    const r = await call(role, '/api/meta/bootstrap');
    assert(r.data.nav.some(n => n.view === 'teams'));
  }
});

test('ATD monitoring excludes unrelated employee work even on a shared project', async () => {
  const r = await call('atd', '/api/work-entries');
  assert.equal(r.status, 200);
  assert(r.data.items.some(e => e.refNo === 'ATD-AUTHORIZED'));
  assert(!r.data.items.some(e => e.refNo === 'ATD-OTHER-SERVICE'));
});
test('ATD cannot approve work for an employee outside the saved reporting/team scope', async () => {
  const entry = await f.models.WorkEntry.findOne({ refNo: 'ATD-OTHER-SERVICE' });
  const r = await call('atd', '/api/work-entries/' + entry._id + '/decision', 'PATCH', { status: 'Approved' });
  assert.equal(r.status, 404);
});
