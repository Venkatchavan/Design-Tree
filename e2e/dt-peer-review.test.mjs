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
  for (const [role, u] of Object.entries(f.cast)) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: f.password }) });
    assert.equal(r.status, 200); cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());

const B = '/api/dt-peer-review';
let pkg;

test('peer reviewer creates the package; directors read only; out-of-scope logins cannot see it', async () => {
  const meta = await call('peer', `${B}/meta`);
  assert.equal(meta.status, 200);
  assert.deepEqual(meta.data.projects.map(p => p._id), [f.project]);
  assert.equal(meta.data.stages.length, 7);
  assert.equal((await call('md', B, 'POST', { project: f.project })).status, 403);
  const created = await call('peer', B, 'POST', { project: f.project, client: 'Sample Developer', principalConsultant: 'Sample Consultants', location: 'Bengaluru' });
  assert.equal(created.status, 201);
  pkg = created.data.item;
  assert.equal(pkg.checklist.length, 25); assert.equal(pkg.approvals.length, 7);
  assert.equal(created.data.summary.status, 'Blocked — not ready for issue');
  assert.equal((await call('peer', B, 'POST', { project: f.project })).status, 409);
  assert.equal((await call('md', `${B}/${pkg._id}`)).status, 200);
  assert.equal((await call('td', B)).data.items.length, 1);
  assert.equal((await call('outsider', `${B}/${pkg._id}`)).status, 404);
  assert.equal((await call('outsider', B)).data.items.length, 0);
  assert.equal((await call('md', `${B}/${pkg._id}`, 'PATCH', { client: 'x' })).status, 403);
});

test('comment rounds: response, open round, response, closed by the lead only', async () => {
  await call('peer', `${B}/${pkg._id}`, 'PATCH', { team: { checker: f.cast.peer.employee, lead: f.cast.peerhead.employee, principal: f.cast.peerhead.employee } });
  let r = await call('peer', `${B}/${pkg._id}/comments`, 'POST', { stage: 'S1', document: 'DBR-R01', topic: 'Wind Load', comment: 'State Vb.', commentDate: '2026-08-04' });
  assert.equal(r.status, 201);
  const c = r.data.item.comments[0];
  assert.equal(r.data.summary.commentStates[c._id].label, 'Awaiting consultant response');
  assert.equal((await call('peer', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'review', verdict: 'Closed' })).status, 409);
  r = await call('peer', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'response', response: 'Vb 33 m/s.', responseDate: '2026-08-06' });
  assert.equal(r.data.summary.commentStates[c._id].label, 'Awaiting DesignTree review');
  assert.equal((await call('peer', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'review', verdict: 'Closed' })).status, 403);
  r = await call('peerhead', `${B}/${pkg._id}/comments/${c._id}/rounds`, 'POST', { kind: 'review', verdict: 'Closed', commentDate: '2026-08-08' });
  assert.equal(r.status, 201);
  assert.equal(r.data.summary.comments.open, 0);
  assert.equal(r.data.summary.comments.avgClosureDays, 4);
});

test('stage sign-off needs closed items, no open comments and the lead/principal', async () => {
  let doc = (await call('peer', `${B}/${pkg._id}`)).data.item;
  assert.equal((await call('peerhead', `${B}/${pkg._id}/stages/S1/sign-off`, 'POST')).status, 409);
  for (const i of doc.checklist.filter(i => i.stage === 'S1')) {
    const r = await call('peer', `${B}/${pkg._id}/checklist/${i._id}`, 'PATCH', { status: 'Verified' });
    assert.equal(r.status, 200);
  }
  doc = (await call('peer', `${B}/${pkg._id}`)).data.item;
  assert.equal(doc.checklist.find(i => i.stage === 'S1').stamped.byName, 'Test peer Workflow');
  assert.equal((await call('peer', `${B}/${pkg._id}/stages/S1/sign-off`, 'POST')).status, 403);
  const r = await call('peerhead', `${B}/${pkg._id}/stages/S1/sign-off`, 'POST');
  assert.equal(r.status, 200);
  assert.equal(r.data.summary.stages[0].status, 'Signed off');
  assert.equal(r.data.summary.signed, 1);
  const s1 = doc.checklist.find(i => i.stage === 'S1');
  assert.equal((await call('peer', `${B}/${pkg._id}/checklist/${s1._id}`, 'PATCH', { status: 'Not Started' })).status, 409);
});

test('only the principal approves deliverables and releases an unblocked package', async () => {
  let doc = (await call('peer', `${B}/${pkg._id}`)).data.item;
  assert.equal((await call('peer', `${B}/${pkg._id}/approvals/${doc.approvals[0]._id}`, 'PATCH', { status: 'Approved' })).status, 403);
  assert.equal((await call('peer', `${B}/${pkg._id}/approvals/${doc.approvals[0]._id}`, 'PATCH', { status: 'Submitted' })).status, 200);
  assert.equal((await call('peerhead', `${B}/${pkg._id}/release`, 'POST')).status, 409);
  for (const i of doc.checklist.filter(i => i.stage !== 'S1')) await call('peer', `${B}/${pkg._id}/checklist/${i._id}`, 'PATCH', { status: 'N.A.' });
  for (const s of ['S2', 'S3', 'S4', 'S5', 'S6', 'S7']) assert.equal((await call('peerhead', `${B}/${pkg._id}/stages/${s}/sign-off`, 'POST')).status, 200);
  for (const a of doc.approvals) assert.equal((await call('peerhead', `${B}/${pkg._id}/approvals/${a._id}`, 'PATCH', { status: 'Approved' })).status, 200);
  assert.equal((await call('peer', `${B}/${pkg._id}/release`, 'POST')).status, 403);
  const r = await call('peerhead', `${B}/${pkg._id}/release`, 'POST');
  assert.equal(r.status, 200); assert.equal(r.data.summary.status, 'Released for issue');
  assert.equal((await call('peer', `${B}/${pkg._id}/comments`, 'POST', { stage: 'S2', comment: 'late' })).status, 409);
});
