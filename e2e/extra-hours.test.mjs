import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// 05 Nov 2026 client request: after 8 hours of login the employee is asked why
// at sign-out; the reason goes to the reporting TL / PTL (and mapped
// directors), who approve or decline. Approving needs a reason.
let f; const cookies = {};
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
async function login(role) {
  const u = f.cast[role];
  const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
  assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
}
before(async () => {
  f = await startLocalFixture();
  // engineer reports to the TL; the TD is the engineer's mapped director.
  await f.models.Employee.updateOne({ _id: f.cast.engineer.employee }, { reportingManager: 'TEST-tl', director: 'TEST-td' });
  for (const role of Object.keys(f.cast)) await login(role);
});
after(async () => f?.stop());

const AttendanceDay = () => import('../api/src/models/AttendanceDay.js').then(m => m.AttendanceDay);

test('sign-out after more than 8 hours asks why and queues it for the reporting TL', async () => {
  const A = await AttendanceDay();
  // Logged in 9h ago on a working day (late reason pre-filled so only the extra-hours gate is under test).
  await A.updateOne({ employee: f.cast.engineer.employee }, { loginAt: new Date(Date.now() - 9 * 3600000), workingDay: true, lateReason: 'n/a' });
  const status = await call('engineer', '/api/attendance/status');
  assert.equal(status.data.overHours, true);
  assert.equal(status.data.underHours, false);

  const held = await fetch(f.base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookies.engineer, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(held.status, 400);
  assert.equal((await held.json()).code, 'EXTRA_HOURS_REASON_REQUIRED');

  const out = await fetch(f.base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookies.engineer, 'Content-Type': 'application/json' }, body: JSON.stringify({ extraHoursReason: 'Drawing issue deadline' }) });
  assert.equal(out.status, 200);
  const doc = await A.findOne({ employee: f.cast.engineer.employee });
  assert.equal(doc.extraHoursStatus, 'pending');
  assert.equal(doc.extraHoursReason, 'Drawing issue deadline');
  assert.ok(doc.extraHours >= 0.9 && doc.extraHours <= 1.1, `extraHours ${doc.extraHours}`);
  assert.ok(doc.logoutAt);
});

test('only the reporting chain sees the request; approving needs a reason; it is decided once', async () => {
  await login('engineer');
  const mine = await call('tl', '/api/attendance/extra-hours');
  assert.equal(mine.status, 200);
  assert.equal(mine.data.items.length, 1);
  const id = mine.data.items[0]._id;
  assert.equal((await call('td', '/api/attendance/extra-hours')).data.items.length, 1, 'mapped director sees it');
  assert.equal((await call('md', '/api/attendance/extra-hours')).data.items.length, 1, 'founding director sees all');
  assert.equal((await call('outsider', '/api/attendance/extra-hours')).data.items.length, 0);
  assert.equal((await call('outsider', `/api/attendance/extra-hours/${id}`, 'PATCH', { status: 'approved', reason: 'x' })).status, 404);
  assert.equal((await call('engineer', `/api/attendance/extra-hours/${id}`, 'PATCH', { status: 'approved', reason: 'self' })).status, 404);

  assert.equal((await call('tl', `/api/attendance/extra-hours/${id}`, 'PATCH', { status: 'approved' })).status, 400);
  const ok = await call('tl', `/api/attendance/extra-hours/${id}`, 'PATCH', { status: 'approved', reason: 'Client deadline confirmed' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.item.extraHoursStatus, 'approved');
  assert.equal(ok.data.item.extraHoursDecisionReason, 'Client deadline confirmed');
  assert.equal((await call('tl', `/api/attendance/extra-hours/${id}`, 'PATCH', { status: 'declined' })).status, 409);
  assert.equal((await call('tl', '/api/attendance/extra-hours?status=pending')).data.items.length, 0);
});

test('decline needs no reason; under 8 hours never asks', async () => {
  const A = await AttendanceDay();
  await A.updateOne({ employee: f.cast.engineer.employee }, { extraHoursStatus: 'pending', extraHoursDecisionReason: null });
  const id = String((await A.findOne({ employee: f.cast.engineer.employee }))._id);
  const declined = await call('tl', `/api/attendance/extra-hours/${id}`, 'PATCH', { status: 'declined' });
  assert.equal(declined.status, 200);
  assert.equal(declined.data.item.extraHoursStatus, 'declined');

  await login('qs');
  await A.updateOne({ employee: f.cast.qs.employee }, { loginAt: new Date(Date.now() - 8.5 * 3600000 + 60 * 60000), workingDay: true, lateReason: 'n/a' });
  const st = await call('qs', '/api/attendance/status');
  assert.equal(st.data.overHours, false);
});
