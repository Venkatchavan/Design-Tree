import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';

// Client document 17 Nov 2026: service-wise MEPF stages and deliverables,
// Assign Work lists, SPOC service handover and DMH assignment options.
let f; const cookies = {};
const roles = ['tl', 'atd', 'spoc', 'dmh', 'outsider', 'engineer'];
before(async () => {
  f = await startLocalFixture();
  for (const role of roles) {
    const r = await fetch(f.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.cast[role].email, password: f.password }) });
    cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => { await f?.stop(); });
async function call(role, path, method = 'GET', body) {
  const r = await fetch(f.base + path, { method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}

test('1. an SMEPF project has a separate stage tracker for S, M, E, P and F', async () => {
  const r = await call('dmh', '/api/billing/stage-timeline?project=' + f.project);
  assert.equal(r.status, 200);
  const services = r.data.summaries.map((s) => s.service);
  for (const s of ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire']) assert(services.includes(s), `missing ${s} tracker`);
  assert(!services.includes('SMEPF'));
});

test('1. deliverables are saved, listed and logged per service', async () => {
  const created = await call('tl', '/api/work/deliverables', 'POST', { project: f.project, service: 'HVAC', stage: 'Concept', deliverable: 'HVAC load calculation' });
  assert.equal(created.status, 201);
  assert.equal(created.data.item.service, 'HVAC');
  await call('tl', '/api/work/deliverables', 'POST', { project: f.project, service: 'STR', stage: 'Concept', deliverable: 'Preliminary framing plan' });
  const hvac = await call('tl', `/api/work/deliverables?project=${f.project}&service=HVAC`);
  assert.deepEqual(hvac.data.items.map((d) => d.deliverable), ['HVAC load calculation']);
  const log = await call('tl', '/api/work/deliverables-log?project=' + f.project);
  assert(log.data.items.some((l) => l.service === 'HVAC' && l.deliverable === 'HVAC load calculation'));
});

test('2. ATD Assign Work lists their reporting team grouped by department service', async () => {
  const atd = await f.models.Employee.findById(f.cast.atd.employee).lean();
  const mech = await f.models.Employee.create({ firstName: 'Mech', lastName: 'Designer', empId: 'ATD-RPT-1', department: 'HVAC', reportingManager: atd.empId });
  const fire = await f.models.Employee.create({ firstName: 'Fire', lastName: 'Designer', empId: 'ATD-RPT-2', department: 'F&LS', reportingManager: atd.empId });
  const r = await call('atd', '/api/work/tasks/assignees?project=' + f.project);
  assert.equal(r.status, 200);
  const row = (e) => r.data.items.find((m) => String(m.employee._id) === String(e._id));
  assert.equal(row(mech)?.service, 'Mechanical');
  assert.equal(row(fire)?.service, 'Fire');
  const task = await call('atd', '/api/work/tasks', 'POST', { project: f.project, members: [String(mech._id)], deliverable: 'ATD reporting task' });
  assert.equal(task.status, 201);
});

test('2. TL reporting team members keep their own department service', async () => {
  const tl = await f.models.Employee.findById(f.cast.tl.employee).lean();
  const ele = await f.models.Employee.create({ firstName: 'Ele', lastName: 'Designer', empId: 'TL-RPT-ELE', department: 'Electrical', reportingManager: tl.empId });
  const r = await call('tl', '/api/work/tasks/assignees?project=' + f.project);
  assert.equal(r.data.items.find((m) => String(m.employee._id) === String(ele._id))?.service, 'Electrical');
});

test('4. SPOC notifies the next service, which acknowledges; status stays visible', async () => {
  await f.models.Team.create({ name: 'Assigned HVAC team', service: 'HVAC', branch: 'Test HQ', lead: f.cast.outsider.employee, projects: [f.project] });
  const sent = await call('spoc', '/api/service-handovers', 'POST', { project: f.project, fromService: 'STR', toServices: ['HVAC'], stage: 'Concept', note: 'Framing plan issued' });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));
  assert.equal(sent.data.item.status, 'Notified');
  assert(sent.data.item.recipients.some((e) => String(e._id) === f.cast.outsider.employee));
  // Nobody is allocated for Fire yet: nothing is sent.
  assert.equal((await call('spoc', '/api/service-handovers', 'POST', { project: f.project, fromService: 'STR', toServices: ['FIRE'] })).status, 400);
  // Only the SPOC sends; only the notified team acknowledges.
  assert.equal((await call('tl', '/api/service-handovers', 'POST', { project: f.project, fromService: 'STR', toServices: ['HVAC'] })).status, 403);
  assert.equal((await call('engineer', `/api/service-handovers/${sent.data.item._id}/acknowledge`, 'PATCH')).status, 404);
  const mine = await call('outsider', '/api/service-handovers?mine=1');
  assert(mine.data.items.some((h) => h._id === sent.data.item._id));
  const ack = await call('outsider', `/api/service-handovers/${sent.data.item._id}/acknowledge`, 'PATCH');
  assert.equal(ack.status, 200);
  assert.equal(ack.data.item.status, 'Acknowledged');
  const spocList = await call('spoc', '/api/service-handovers');
  assert.equal(spocList.data.items.find((h) => h._id === sent.data.item._id)?.status, 'Acknowledged');
});

test('5. DMH options are read from records: MEPF and STR leads, Peer Review staff', async () => {
  const mepLead = await f.models.Employee.create({ firstName: 'Hvac', lastName: 'Lead', empId: 'MEPF-TL-1', department: 'HVAC', designation: 'Team Lead - HVAC' });
  const r = await call('dmh', '/api/design-team/assign-options');
  assert.equal(r.status, 200);
  const ids = (list) => list.map((e) => e._id);
  assert(ids(r.data.MEPF).includes(String(mepLead._id)));
  assert(!ids(r.data.MEPF).includes(f.cast.tl.employee));
  assert(ids(r.data.STR).includes(f.cast.tl.employee));
  assert(!ids(r.data.STR).includes(String(mepLead._id)));
  assert(ids(r.data['Peer Review']).includes(f.cast.peer.employee));
  assert(ids(r.data['Peer Review']).includes(f.cast.peerhead.employee));
  assert(!ids(r.data['Peer Review']).includes(f.cast.engineer.employee));
  assert.equal((await call('spoc', '/api/design-team/assign-options')).status, 403);
});

test('5. DMH assigns MEPF, STR and Peer Review people to the project', async () => {
  const mepLead = await f.models.Employee.findOne({ empId: 'MEPF-TL-1' }).lean();
  const mepf = await call('dmh', `/api/design-team/projects/${f.project}/assign`, 'POST', { option: 'MEPF', person: String(mepLead._id) });
  assert.equal(mepf.status, 200, JSON.stringify(mepf.data));
  const peer = await call('dmh', `/api/design-team/projects/${f.project}/assign`, 'POST', { option: 'Peer Review', person: f.cast.peer.employee });
  assert.equal(peer.status, 200);
  // Someone outside the option's list is refused.
  assert.equal((await call('dmh', `/api/design-team/projects/${f.project}/assign`, 'POST', { option: 'STR', person: String(mepLead._id) })).status, 400);
  // Reassignment needs a reason.
  assert.equal((await call('dmh', `/api/design-team/projects/${f.project}/assign`, 'POST', { option: 'Peer Review', person: f.cast.peerhead.employee })).status, 400);
  assert.equal((await call('dmh', `/api/design-team/projects/${f.project}/assign`, 'POST', { option: 'Peer Review', person: f.cast.peerhead.employee, reason: 'Workload' })).status, 200);
  const project = await f.models.Project.findById(f.project).lean();
  const rows = project.principalTeamLeads.filter((r) => r.nominatedBy === 'Design Management Head');
  assert.deepEqual(rows.map((r) => [r.service, String(r.employee)]).sort(), [['MEPF', String(mepLead._id)], ['Peer Review', f.cast.peerhead.employee]].sort());
  const team = await f.models.Team.findOne({ allocationProject: f.project, allocationService: 'Mechanical + Electrical + Plumbing + Fire' }).lean();
  assert(team, 'MEPF service team is created');
  // SMEPF keeps the existing SPOC assignment rules.
  assert.equal((await call('dmh', `/api/design-team/projects/${f.project}/assign`, 'POST', { option: 'SMEPF', spoc: f.cast.spoc.employee, expectedSpoc: f.cast.spoc.employee })).status, 409);
});
