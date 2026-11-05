import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// 05 Nov 2026 client PDF: assigned work reflects for engineers, task actions no
// longer answer "Not found", assignment / due-date alerts, TL work progress is
// the reporting team, hours per project in the team log, directors lose My team.
let f; const cookies = {};
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
const api = (path) => import(new URL(`../api/${path}`, import.meta.url).href);
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

before(async () => {
  f = await startLocalFixture();
  const { cast, models } = f;
  // TL leads the engineer and the outsider; the TL reports to the Executive Director (Electrical).
  await models.Employee.updateOne({ _id: cast.engineer.employee }, { reportingManager: 'TEST-tl' });
  await models.Employee.updateOne({ _id: cast.outsider.employee }, { reportingManager: 'TEST-tl' });
  await models.Employee.updateOne({ _id: cast.tl.employee }, { director: 'TEST-ed' });
  await models.Employee.updateOne({ _id: cast.ed.employee }, { department: 'Electrical' });
  for (const role of Object.keys(cast)) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cast[role].email, password: f.password }) });
    assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());

let taskId;
test('a TL assigns work to a reporting engineer; the engineer is notified and can acknowledge, start and submit', async () => {
  // The outsider is only in an unrelated team, so the project is not on their Team allocations.
  const created = await call('tl', '/api/work/tasks', 'POST', { project: f.project, members: [f.cast.outsider.employee], stage: 'CD', deliverable: 'Soil retention', dueDate: day(5) });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  taskId = created.data.item._id;
  await new Promise((r) => setTimeout(r, 300));
  const bell = await call('outsider', '/api/notifications');
  assert.ok(bell.data.items.some((n) => n.type === 'task-assigned' && /Soil retention/.test(n.title)), 'assignment alert');
  for (const status of ['Open', 'In Progress', 'Submitted']) {
    const r = await call('outsider', `/api/work/tasks/${taskId}/status`, 'PATCH', { status });
    assert.equal(r.status, 200, `${status}: ${JSON.stringify(r.data)}`);
  }
  // An unrelated engineer still cannot touch it.
  assert.equal((await call('engineer', `/api/work/tasks/${taskId}/status`, 'PATCH', { status: 'Open' })).status, 403);
});

test('assigned and Executive Director hierarchy projects reflect for the engineer and the TL', async () => {
  const mine = await call('outsider', '/api/teams/mine');
  const ids = mine.data.items.flatMap((t) => t.projects.map((p) => String(p._id)));
  assert.ok(ids.includes(f.project), 'assigned project listed');
  assert.ok(mine.data.items.some((t) => t.derived));
  // SMEPF includes Electrical, so Mitra's TL and the TL's team see it with no Team row.
  await f.models.Team.updateMany({ lead: f.cast.tl.employee }, { $set: { active: false } });
  const tl = await call('tl', '/api/teams/mine');
  assert.ok(tl.data.items.some((t) => t.derived && t.projects.some((p) => String(p._id) === f.project)), 'hierarchy project for the TL');
  assert.ok(!tl.data.items.some((t) => t.projects.some((p) => String(p._id) === f.other)), 'other services stay hidden');
  await f.models.Team.updateMany({ lead: f.cast.tl.employee }, { $set: { active: true } });
});

test('due-soon and overdue alerts fire once; the assigning TL hears about overdue work', async () => {
  const { runTaskAlerts } = await api('src/services/taskAlerts.js');
  const { Task } = await api('src/models/Task.js');
  await Task.create({ project: f.project, members: [f.cast.engineer.employee], stage: 'SD', deliverable: 'Overdue sheet', dueDate: new Date(`${day(-2)}T00:00:00Z`), status: 'Open', createdBy: f.cast.tl.user });
  await Task.create({ project: f.project, members: [f.cast.engineer.employee], stage: 'SD', deliverable: 'Tomorrow sheet', dueDate: new Date(`${day(1)}T00:00:00Z`), status: 'In Progress', createdBy: f.cast.tl.user });
  await Task.create({ project: f.project, members: [f.cast.engineer.employee], stage: 'SD', deliverable: 'Done sheet', dueDate: new Date(`${day(-2)}T00:00:00Z`), status: 'Submitted', createdBy: f.cast.tl.user });
  const first = await runTaskAlerts();
  assert.ok(first >= 2);
  const bell = (await call('engineer', '/api/notifications')).data.items;
  assert.ok(bell.some((n) => n.type === 'task-overdue' && /Overdue sheet/.test(n.title)));
  assert.ok(bell.some((n) => n.type === 'task-due-soon' && /Tomorrow sheet/.test(n.title)));
  assert.ok(!bell.some((n) => /Done sheet/.test(n.title)), 'submitted work is not chased');
  assert.ok((await call('tl', '/api/notifications')).data.items.some((n) => n.type === 'task-overdue' && /Overdue sheet/.test(n.title)));
  assert.equal(await runTaskAlerts(), 0, 'each alert fires once');
});

test('TL work progress covers the reporting team; project hours appear per employee in the team directory', async () => {
  const { WorkEntry } = await api('src/models/WorkEntry.js');
  const mk = (employee, project, hours) => WorkEntry.create({ createdBy: f.cast.tl.user, employee, project, date: new Date(), hours, wuNo: `WU-${Math.random().toString(36).slice(2, 8)}`, status: 'Pending' });
  // Logged on a project the TL has no Team for: still the TL's team's work.
  await mk(f.cast.outsider.employee, f.other, 2);
  await mk(f.cast.engineer.employee, f.project, 1.5);
  await mk(f.cast.engineer.employee, f.project, 2);
  const report = await call('tl', `/api/reports/work-hours?from=${day()}&to=${day()}`);
  assert.equal(report.status, 200);
  const who = new Set(report.data.items.map((e) => String(e.employee?._id)));
  assert.ok(who.has(f.cast.outsider.employee) && who.has(f.cast.engineer.employee));
  const dir = await call('tl', '/api/teams/reporting-directory');
  const row = dir.data.hours.find((h) => h.employee === f.cast.engineer.employee && h.project === f.project);
  assert.equal(row?.hours, 3.5);
  // Not-yet-updated counts team members only, never the whole company.
  const team = dir.data.employees.map((e) => String(e._id));
  assert.ok(team.includes(f.cast.engineer.employee) && !team.includes(f.cast.md.employee));
});

test('directors no longer get My team; the PTL login is no longer named after an engineer', async () => {
  for (const role of ['md', 'wd', 'ed']) {
    const nav = (await call(role, '/api/meta/bootstrap')).data.nav.map((n) => n.view);
    assert.ok(!nav.includes('my-team'), role);
    assert.ok(nav.includes('teams'), role);
  }
  const { USERS } = await api('src/data/blr-users.js');
  const row = USERS.find((u) => u.email === 'arunkumar@designtreeconsultants.com');
  assert.deepEqual([row.name, row.role], ['Arun Kumar S R', 'team_lead']);
});

test('any TL who can open the project enters stage start, expected and actual dates for their own department only', async () => {
  const { models, cast } = f;
  const sample = await models.User.findById(cast.tl.user).select('+passwordHash').lean();
  // Team member (not the named lead) with the TL role, and a TL from an unrelated department.
  const make = async (key, employee) => {
    const u = await models.User.create({ name: key, email: `${key}@stage.example`, role: 'team_lead', employee, passwordHash: sample.passwordHash });
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
    cookies[key] = r.headers.get('set-cookie').split(';')[0];
  };
  await make('memberTl', cast.engineer.employee);
  await make('otherTl', cast.qs.employee);
  await models.Employee.updateOne({ _id: cast.qs.employee }, { department: 'Accounts' });
  const stage = (extra) => ({ project: f.project, service: 'SMEPF', stage: 'CD', expectedVersion: 0, ...extra });
  const dates = { planDates: true, startDate: '2026-08-01', plannedCompletion: '2026-08-14' };
  assert.equal((await call('otherTl', '/api/billing/stages', 'POST', stage(dates))).status, 403, 'unrelated department stays out');
  const planned = await call('memberTl', '/api/billing/stages', 'POST', stage(dates));
  assert.equal(planned.status, 200, JSON.stringify(planned.data));
  const timeline = await call('memberTl', `/api/billing/stage-timeline?project=${f.project}`);
  const cd = timeline.data.items.find((r) => r.service === 'SMEPF' && r.stage === 'CD');
  assert.equal(cd.permissions.request, true, 'Mark complete is offered');
  const done = await call('memberTl', '/api/billing/stages', 'POST', stage({ expectedVersion: planned.data.item.__v, requestCompletion: true, actualCompletion: '2026-08-12' }));
  assert.equal(done.status, 200, JSON.stringify(done.data));
});
