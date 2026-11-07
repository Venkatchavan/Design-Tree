import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// DT Peer Review (3 Nov 2026 client request): STR peer review package with
// stages, master checklist, approval gate and round-based comment log.
let f; const cookies = {};
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  f = await startLocalFixture();
  // Map fixture logins onto the people named in the 7 Nov requirement (config/dtPeerReviewAccess.js).
  const map = { finance: { email: 'arpithad@designtreeconsultants.com' }, atd: { email: 'srinivasarao@designtreeconsultants.com' }, peer: { empId: 'DT-25-1690' }, qs: { empId: 'DT-26-1859' } };
  for (const [key, v] of Object.entries(map)) {
    if (v.email) { await f.models.User.updateOne({ _id: f.cast[key].user }, { email: v.email }); f.cast[key].email = v.email; }
    if (v.empId) await f.models.Employee.updateOne({ _id: f.cast[key].employee }, { empId: v.empId });
  }
  for (const [role, u] of Object.entries(f.cast)) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
    assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());

const B = '/api/dt-peer-review';
let pkg;

test('Admin allots the project to the review team; directors and others cannot', async () => {
  // Admin = Arpitha D (finance fixture login). Only the named people may allot.
  const meta = await call('finance', `${B}/meta`);
  assert.equal(meta.status, 200);
  assert(meta.data.projects.map(p => p._id).includes(f.project));
  assert.equal(meta.data.stages.length, 7);
  assert.deepEqual(meta.data.employees.map(e => e.empId).sort(), ['DT-25-1690', 'DT-26-1859']);
  for (const role of ['peer', 'peerhead', 'md', 'td', 'tl']) assert.equal((await call(role, B, 'POST', { project: f.project, reviewTeam: [f.cast.peer.employee] })).status, 403, role);
  assert.equal((await call('finance', B, 'POST', { project: f.project, reviewTeam: [] })).status, 400);
  // The team can only come from the approved reviewers.
  assert.equal((await call('finance', B, 'POST', { project: f.project, reviewTeam: [f.cast.engineer.employee] })).status, 400);
  const created = await call('finance', B, 'POST', { project: f.project, reviewTeam: [f.cast.peer.employee], client: 'Sample Developer', principalConsultant: 'Sample Consultants', location: 'Bengaluru' });
  assert.equal(created.status, 201);
  pkg = created.data.item;
  assert.deepEqual(pkg.reviewTeam.map(e => e._id), [f.cast.peer.employee]);
  assert.equal(pkg.checklist.length, 25); assert.equal(pkg.approvals.length, 7);
  assert.equal(created.data.canWrite, false);
  assert.equal(created.data.summary.status, 'Blocked — not ready for issue');
  assert.equal((await call('finance', B, 'POST', { project: f.project, reviewTeam: [f.cast.peer.employee] })).status, 409);
  // The review team no longer enters names: the header form ignores any team field.
  const header = await call('peer', `${B}/${pkg._id}`, 'PATCH', { client: 'Edited', team: { lead: f.cast.peer.employee } });
  assert.equal(header.status, 200); assert.equal(header.data.item.client, 'Edited');
  assert.deepEqual(header.data.item.reviewTeam.map(e => e._id), [f.cast.peer.employee]);
  assert.equal(header.data.item.team, undefined);
});

test('log is read only for Founding Director and Srinivasa Rao; no other director or login sees it', async () => {
  for (const role of ['md', 'atd']) {
    assert.equal((await call(role, `${B}/${pkg._id}`)).status, 200, role);
    assert.equal((await call(role, B)).data.items.length, 1, role);
    assert.equal((await call(role, `${B}/${pkg._id}`)).data.canWrite, false, role);
    assert.equal((await call(role, `${B}/${pkg._id}`, 'PATCH', { client: 'x' })).status, 403, role);
    assert.equal((await call(role, `${B}/${pkg._id}/checklist`, 'POST', { stage: 'S1', item: 'x' })).status, 403, role);
    assert.equal((await call(role, `${B}/${pkg._id}/comments`, 'POST', { stage: 'S1', comment: 'x' })).status, 403, role);
    assert.equal((await call(role, `${B}/${pkg._id}/release`, 'POST')).status, 403, role);
    assert.equal((await call(role, `${B}/${pkg._id}/team`, 'PUT', { reviewTeam: [f.cast.peer.employee] })).status, 403, role);
  }
  // Working / Executive / Technical / Assoc. Technical directors and everyone else: refused.
  for (const role of ['wd', 'ed', 'td', 'associate', 'tl', 'outsider', 'qs', 'engineer']) {
    assert.equal((await call(role, B)).status, 403, role);
    assert.equal((await call(role, `${B}/meta`)).status, 403, role);
    assert.equal((await call(role, `${B}/${pkg._id}`)).status, 404, role);
  }
  const boot = await call('md', '/api/meta/bootstrap');
  assert.equal(boot.data.capabilities.dtPeerReview.read, true);
  assert.equal((await call('wd', '/api/meta/bootstrap')).data.capabilities.dtPeerReview.read, false);
  assert.equal((await call('atd', '/api/meta/bootstrap')).data.nav.some(n => n.view === 'dt-peer-review'), true);
  assert.equal((await call('td', '/api/meta/bootstrap')).data.nav.some(n => n.view === 'dt-peer-review'), false);
});

test('Admin can change the allotted team; only the allotted team works the package', async () => {
  assert.equal((await call('qs', B)).status, 403);
  assert.equal((await call('qs', `${B}/${pkg._id}/checklist`, 'POST', { stage: 'S1', item: 'x' })).status, 404);
  let r = await call('finance', `${B}/${pkg._id}/team`, 'PUT', { reviewTeam: [f.cast.peer.employee, f.cast.qs.employee] });
  assert.equal(r.status, 200); assert.equal(r.data.item.reviewTeam.length, 2);
  assert.equal((await call('qs', B)).data.items.length, 1);
  assert.equal((await call('qs', `${B}/${pkg._id}/checklist`, 'POST', { stage: 'S1', item: 'Added by second reviewer' })).status, 201);
  assert.equal((await call('peer', `${B}/${pkg._id}/team`, 'PUT', { reviewTeam: [f.cast.peer.employee] })).status, 403);
  r = await call('finance', `${B}/${pkg._id}/team`, 'PUT', { reviewTeam: [f.cast.peer.employee] });
  assert.equal(r.status, 200);
  assert.equal((await call('qs', B)).status, 403);
  assert.equal((await call('finance', `${B}/${pkg._id}/comments`, 'POST', { stage: 'S1', comment: 'admin cannot write' })).status, 403);
});

test('comment rounds: response, open round, response, closed by the allotted team', async () => {
  let r = await call('peer', `${B}/${pkg._id}/comments`, 'POST', { stage: 'S1', document: 'DBR-R01', topic: 'Wind Load', comment: 'State Vb.', commentDate: '2026-08-04' });
  assert.equal(r.status, 201);
  const c = r.data.item.comments[0];
  assert.equal(r.data.summary.commentStates[c._id].label, 'Awaiting consultant response');
  assert.equal((await call('peer', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'review', verdict: 'Closed' })).status, 409);
  r = await call('peer', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'response', response: 'Vb 33 m/s.', responseDate: '2026-08-06' });
  assert.equal(r.data.summary.commentStates[c._id].label, 'Awaiting DesignTree review');
  for (const role of ['md', 'atd', 'finance']) assert.equal((await call(role, `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'review', verdict: 'Closed' })).status, 403, role);
  r = await call('peer', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'review', verdict: 'Closed', commentDate: '2026-08-08' });
  assert.equal(r.status, 201);
  assert.equal(r.data.summary.comments.open, 0);
  assert.equal(r.data.summary.comments.avgClosureDays, 4);
});

test('stage sign-off needs closed items and no open comments', async () => {
  let doc = (await call('peer', `${B}/${pkg._id}`)).data.item;
  assert.equal((await call('peer', `${B}/${pkg._id}/stages/S1/sign-off`, 'POST')).status, 409);
  for (const i of doc.checklist.filter(i => i.stage === 'S1')) {
    const r = await call('peer', `${B}/${pkg._id}/checklist/${i._id}`, 'PATCH', { status: 'Verified' });
    assert.equal(r.status, 200);
  }
  doc = (await call('peer', `${B}/${pkg._id}`)).data.item;
  assert.equal(doc.checklist.find(i => i.stage === 'S1').stamped.byName, 'Test peer Workflow');
  assert.equal((await call('md', `${B}/${pkg._id}/stages/S1/sign-off`, 'POST')).status, 403);
  const r = await call('peer', `${B}/${pkg._id}/stages/S1/sign-off`, 'POST');
  assert.equal(r.status, 200);
  assert.equal(r.data.summary.stages[0].status, 'Signed off');
  assert.equal(r.data.summary.signed, 1);
  const s1 = doc.checklist.find(i => i.stage === 'S1');
  assert.equal((await call('peer', `${B}/${pkg._id}/checklist/${s1._id}`, 'PATCH', { status: 'Not Started' })).status, 409);
});

test('the allotted team approves deliverables and releases an unblocked package; it is then read only', async () => {
  let doc = (await call('peer', `${B}/${pkg._id}`)).data.item;
  assert.equal((await call('md', `${B}/${pkg._id}/approvals/${doc.approvals[0]._id}`, 'PATCH', { status: 'Approved' })).status, 403);
  assert.equal((await call('peer', `${B}/${pkg._id}/approvals/${doc.approvals[0]._id}`, 'PATCH', { status: 'Submitted' })).status, 200);
  assert.equal((await call('peer', `${B}/${pkg._id}/release`, 'POST')).status, 409);
  for (const i of doc.checklist.filter(i => i.stage !== 'S1')) await call('peer', `${B}/${pkg._id}/checklist/${i._id}`, 'PATCH', { status: 'N.A.' });
  for (const s of ['S2', 'S3', 'S4', 'S5', 'S6', 'S7']) assert.equal((await call('peer', `${B}/${pkg._id}/stages/${s}/sign-off`, 'POST')).status, 200);
  for (const a of doc.approvals) assert.equal((await call('peer', `${B}/${pkg._id}/approvals/${a._id}`, 'PATCH', { status: 'Approved' })).status, 200);
  assert.equal((await call('md', `${B}/${pkg._id}/release`, 'POST')).status, 403);
  const r = await call('peer', `${B}/${pkg._id}/release`, 'POST');
  assert.equal(r.status, 200); assert.equal(r.data.summary.status, 'Released for issue');
  assert.equal((await call('peer', `${B}/${pkg._id}/comments`, 'POST', { stage: 'S2', comment: 'late' })).status, 409);
  assert.equal((await call('finance', `${B}/${pkg._id}/team`, 'PUT', { reviewTeam: [f.cast.peer.employee, f.cast.qs.employee] })).status, 409);
});
