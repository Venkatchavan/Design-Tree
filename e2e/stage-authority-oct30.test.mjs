import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';
let f;
const cookies = {};
before(async () => {
  f = await startLocalFixture();
  for (const key of ['td', 'atd', 'tl', 'spoc', 'dmh']) {
    const r = await fetch(f.base + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: f.cast[key].email,
        password: f.password
      })
    });
    cookies[key] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());
async function call(role, body, method = 'POST', path = '/api/billing/stages') {
  const r = await fetch(f.base + path, {
    method,
    headers: {
      Cookie: cookies[role],
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return {
    status: r.status,
    data: await r.json()
  };
}
async function fixture(code, service = 'MEP') {
  const project = await f.models.Project.create({
    name: code,
    code,
    services: [service]
  });
  await f.models.Team.create({
    name: code + ' unowned bundle team',
    service,
    projects: [project._id],
    lead: f.cast.outsider.employee,
    members: [{
      employee: f.cast.outsider.employee
    }]
  });
  await f.models.Team.create({
    name: code + ' Electrical lead',
    service: 'ELE',
    projects: [project._id],
    lead: f.cast.tl.employee
  });
  await f.models.SpocAllocation.create({
    project: project._id,
    coordinator: f.cast.spoc.employee,
    status: 'Approved',
    services: ['ELE']
  });
  return project;
}
const identity = project => ({
  project: String(project._id),
  service: 'MEP',
  stage: 'CD',
  expectedVersion: 0
});
const dates = {
  startDate: '2026-08-01',
  plannedCompletion: '2026-08-14'
};
for (const role of ['td', 'atd']) test(`${role} Electrical-only ownership plans only the Electrical tracker, never the MEP bundle or another service`, async () => {
  const p = await fixture('PARTIAL-' + role);
  const {
    ServiceDashboard
  } = await import('../api/src/models/ServiceDashboard.js');
  await ServiceDashboard.create({
    project: p._id,
    service: 'ELE',
    technicalDirector: f.cast[role].employee
  });
  const {
    directorTeams
  } = await import('../api/src/utils/directorTeams.js');
  const owned = await directorTeams({
    id: f.cast[role].user,
    role: f.cast[role].role
  });
  assert.deepEqual([...new Set(owned.filter(t => t.projects.some(x => String(x._id) === String(p._id))).map(t => t.service))], ['Electrical']);
  // 17 Nov 2026: an MEP project has one tracker per service; there is no
  // whole-bundle tracker, and another service's tracker stays out of reach.
  for (const service of ['MEP', 'HVAC', 'PHE']) assert.equal((await call(role, {
    ...identity(p),
    service,
    planDates: true,
    ...dates
  })).status, 403, service + ' planning');
  const own = await fixture('OWN-ELE-' + role);
  await ServiceDashboard.create({
    project: own._id,
    service: 'ELE',
    technicalDirector: f.cast[role].employee
  });
  const planned = await call(role, {
    ...identity(own),
    service: 'ELE',
    planDates: true,
    ...dates
  });
  assert.equal(planned.status, 200, JSON.stringify(planned.data));
  assert.equal(planned.data.item.service, 'Electrical');
  const row = await f.models.StageStatus.create({
    project: p._id,
    service: 'MEP',
    stage: 'CD',
    ...dates,
    actualCompletion: '2026-08-14',
    confirmationStatus: 'SPOC Confirmed',
    timelineManaged: true
  });
  for (const service of ['MEP', 'ELE']) assert.equal((await call(role, {
    ...identity(p),
    service,
    approveCompletion: true
  })).status, 403, service + ' approval');
  const saved = await f.models.StageStatus.findById(row._id).lean();
  assert.equal(saved.confirmationStatus, 'SPOC Confirmed');
  assert.equal(saved.billingReadiness, 'Pending');
  assert.equal(saved.approvalSequenceVerified, undefined);
  assert.equal(saved.__v, 0);
  const read = await call(role, undefined, 'GET', '/api/billing/stage-timeline?project=' + p._id);
  assert.equal(read.status, 200);
  const current = read.data.items.find(r => r.stage === 'CD');
  assert.equal(current.permissions.plan, false);
  assert.equal(current.permissions.approve, false);
});
test('partial PTL and SPOC service allocations do not authorize whole-bundle mutations', async () => {
  const p = await fixture('PARTIAL-PTL-SPOC');
  assert.equal((await call('tl', {
    ...identity(p),
    planDates: true,
    ...dates
  })).status, 403);
  let row = await f.models.StageStatus.create({
    project: p._id,
    service: 'MEP',
    stage: 'CD',
    ...dates
  });
  assert.equal((await call('tl', {
    ...identity(p),
    requestCompletion: true,
    actualCompletion: '2026-08-14'
  })).status, 403);
  await f.models.StageStatus.findByIdAndUpdate(row._id, {
    confirmationStatus: 'PTL Requested',
    actualCompletion: '2026-08-14'
  });
  assert.equal((await call('spoc', {
    ...identity(p),
    confirmCompletion: true
  })).status, 403);
  const read = await call('spoc', undefined, 'GET', '/api/billing/stage-timeline?project=' + p._id);
  assert.equal(read.status, 200);
  assert.equal(read.data.items.find(r => r.stage === 'CD').permissions.confirm, false);
});
test('each assigned component service is planned, requested and approved on its own tracker', async () => {
  const p = await fixture('FULL-COMPONENT-UNION');
  const {
    ServiceDashboard
  } = await import('../api/src/models/ServiceDashboard.js');
  for (const service of ['HVAC', 'PHE']) await f.models.Team.create({
    name: 'Full union ' + service,
    service,
    projects: [p._id],
    lead: f.cast.tl.employee
  });
  for (const service of ['ELE', 'HVAC', 'PHE']) await ServiceDashboard.create({
    project: p._id,
    service,
    technicalDirector: f.cast.td.employee
  });
  await f.models.SpocAllocation.updateOne({
    project: p._id,
    coordinator: f.cast.spoc.employee
  }, {
    $set: {
      services: ['ELE', 'HVAC', 'PHE']
    }
  });
  for (const service of ['ELE', 'HVAC', 'PHE']) {
    let r = await call('tl', {
      ...identity(p),
      service,
      planDates: true,
      ...dates
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    let row = r.data.item;
    r = await call('tl', {
      ...identity(p),
      service,
      expectedVersion: row.__v,
      requestCompletion: true,
      actualCompletion: '2026-08-14'
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    row = r.data.item;
    r = await call('spoc', {
      ...identity(p),
      service,
      expectedVersion: row.__v,
      confirmCompletion: true
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.item.billingReadiness, 'Ready for billing');
    assert.equal(r.data.item.approvalSequenceVerified, true);
  }
  assert.equal(await f.models.StageStatus.countDocuments({ project: p._id, stage: 'CD' }), 3);
});
test('normal approved SMEPF allocation synchronizes a composite team and authorizes the per-service TD/ATD workflow', async () => {
  const p = await f.models.Project.create({
    name: 'Synced SMEPF authority',
    code: 'SYNCED-SMEPF',
    services: ['SMEPF']
  });
  await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee, {
    director: f.cast.td.employee,
    reportingManager: f.cast.atd.employee
  });
  await f.models.SpocAllocation.create({
    project: p._id,
    coordinator: f.cast.spoc.employee,
    status: 'Approved',
    services: ['SMEPF']
  });
  const allocated = await call('td', {
    principalTeamLeads: [{
      employee: f.cast.tl.employee,
      service: 'SMEPF',
      approvalStatus: 'Approved',
      role: 'Principal team lead'
    }]
  }, 'PUT', '/api/projects/' + p._id + '/team-leads');
  assert.equal(allocated.status, 200, JSON.stringify(allocated.data));
  const synced = await f.models.Team.findOne({
    allocationProject: p._id
  }).lean();
  assert.equal(synced.service, 'Structural + Mechanical + Electrical + Plumbing + Fire');
  let r = await call('td', {
    ...identity(p),
    service: 'Structural',
    planDates: true,
    ...dates
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  let row = r.data.item;
  assert.equal(row.service, 'Structural');
  r = await call('tl', {
    ...identity(p),
    service: 'STR',
    expectedVersion: row.__v,
    requestCompletion: true,
    actualCompletion: '2026-08-14'
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  row = r.data.item;
  r = await call('spoc', {
    ...identity(p),
    service: 'Structural',
    expectedVersion: row.__v,
    confirmCompletion: true
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.item.billingReadiness, 'Ready for billing');
  assert.equal((await f.models.Team.findById(synced._id).lean()).service, synced.service);
  assert.equal(await f.models.StageStatus.countDocuments({
    project: p._id,
    stage: 'CD'
  }), 1);
  const {
    Notification
  } = await import('../api/src/models/Notification.js');
  const note = await Notification.findOne({
    project: p._id,
    title: 'Stage dates saved'
  }).lean();
  for (const key of ['td', 'atd', 'tl', 'spoc']) assert(note.users.map(String).includes(f.cast[key].user), key + ' notification');
});
test('composite labels normalize codes and aliases without conflating overlap with full coverage', async () => {
  const {
    expandServices
  } = await import('../api/src/config/services.js');
  const {
    sameService
  } = await import('../api/src/utils/stageTimeline.js');
  assert.deepEqual(expandServices(['STR + HVAC + ELE + PHE + FIRE']), expandServices(['SMEPF']));
  assert(sameService('SMEPF', 'Structural + Mechanical + Electrical + Plumbing + Fire'));
  assert(!sameService('ELE', 'MEP'));
});
test('SPOC allocation for one component cannot confirm the whole bundle', async () => {
  const p = await fixture('PARTIAL-SPOC-CONFIRM');
  const row = await f.models.StageStatus.create({
    project: p._id,
    service: 'MEP',
    stage: 'CD',
    ...dates,
    actualCompletion: '2026-08-14',
    confirmationStatus: 'PTL Requested'
  });
  assert.equal((await call('spoc', {
    ...identity(p),
    confirmCompletion: true
  })).status, 403);
  assert.equal((await f.models.StageStatus.findById(row._id).lean()).confirmationStatus, 'PTL Requested');
});
test('saved activated SPOC retains explicit project-wide authority and other-project ownership does not widen bundle rights', async () => {
  const p = await fixture('ACTIVATED-SPOC');
  await f.models.Project.findByIdAndUpdate(p._id, {
    'activation.spoc': f.cast.spoc.employee
  });
  const row = await f.models.StageStatus.create({
    project: p._id,
    service: 'MEP',
    stage: 'CD',
    ...dates,
    actualCompletion: '2026-08-14',
    confirmationStatus: 'PTL Requested'
  });
  const r = await call('spoc', {
    ...identity(p),
    confirmCompletion: true
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.item.confirmationStatus, 'TD Approved');
  assert.equal(r.data.item.billingReadiness, 'Ready for billing');
  // Earlier full-union fixtures belong to other projects and cannot be added
  // to this project's Electrical-only lead scope.
  assert.equal((await call('tl', {
    ...identity(p),
    planDates: true,
    ...dates,
    expectedVersion: r.data.item.__v
  })).status, 403);
  assert.equal((await f.models.StageStatus.findById(row._id).lean()).confirmationStatus, 'TD Approved');
});
