import { execFileSync } from 'node:child_process';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';
let f;
const cookies = {};
before(async () => {
  f = await startLocalFixture();
  const {
    ServiceDashboard
  } = await import('../api/src/models/ServiceDashboard.js');
  await ServiceDashboard.create({
    project: f.project,
    service: 'STR',
    technicalDirector: 'TEST-td'
  });
  await f.models.Employee.findByIdAndUpdate(f.cast.tl.employee, {
    reportingManager: f.cast.atd.employee,
    director: f.cast.td.employee
  });
  await f.models.Team.updateOne({name:'Assigned Structural team'}, {$set:{service:'Structural + Mechanical + Electrical + Plumbing + Fire'}});
  const sample = await f.models.User.findById(f.cast.tl.user).select('+passwordHash').lean();
  for (const [key, role, employee] of [['wrongtl', 'team_lead', f.cast.engineer.employee], ['wrongspoc', 'coordinator', f.cast.outsider.employee], ['wrongtd', 'technical_director', f.cast.outsider.employee]]) {
    const user = await f.models.User.create({
      name: key,
      email: key + '@stage.example',
      role,
      employee,
      passwordHash: sample.passwordHash
    });
    f.cast[key] = {
      email: user.email,
      user: String(user._id),
      employee,
      role
    };
  }
  await f.models.SpocAllocation.create({
    project: f.project,
    coordinator: f.cast.wrongspoc.employee,
    status: 'Proposed',
    services: ['SMEPF']
  });
  for (const key of Object.keys(f.cast)) {
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
const payload = (extra = {}) => ({
  project: f.project,
  service: 'SMEPF',
  stage: 'CD',
  expectedVersion: 0,
  ...extra
});
async function reset() {
  await f.models.StageStatus.deleteMany({});
}
async function plan(extra = {}) {
  const r = await call('tl', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14',
    ...extra
  }));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.item;
}
async function action(role, row, extra) {
  const r = await call(role, {
    project: f.project,
    service: row.service,
    stage: row.stage,
    expectedVersion: row.__v,
    ...extra
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
test('strict TD chain rejects direct completion and unplanned PTL submission', async () => {
  await reset();
  assert.equal((await call('td', payload({
    approveCompletion: true
  }))).status, 409);
  assert.equal((await call('tl', payload({
    requestCompletion: true,
    actualCompletion: '2026-08-18'
  }))).status, 400);
});
test('dates require both real ordered calendar dates, prior-stage approval, service and authorized planner', async () => {
  await reset();
  for (const extra of [{
    startDate: undefined
  }, {
    plannedCompletion: undefined
  }, {
    startDate: '2026-02-30'
  }, {
    plannedCompletion: '2026-07-01'
  }]) assert.equal((await call('tl', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14',
    ...extra
  }))).status, 400);
  assert.equal((await call('tl', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14',
    stage: 'SD'
  }))).status, 409);
  for (const role of ['spoc', 'engineer', 'md', 'admin']) assert.equal((await call(role, payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14'
  }))).status, 403, role);
  assert.equal((await call('td', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14',
    service: 'BIM'
  }))).status, 403);
});
test('locked baseline, reasoned revisions, stale and concurrent versions', async () => {
  await reset();
  let row = await plan();
  assert.equal(row.baselineCompletion.slice(0, 10), '2026-08-14');
  assert.equal((await call('tl', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-17',
    expectedVersion: row.__v
  }))).status, 400);
  const writes = await Promise.all(['A', 'B'].map(reason => call('tl', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-17',
    expectedVersion: row.__v,
    reason
  }))));
  assert.deepEqual(writes.map(x => x.status).sort(), [200, 409]);
  row = writes.find(x => x.status === 200).data.item;
  assert.equal(row.baselineCompletion.slice(0, 10), '2026-08-14');
  assert.equal(row.planRevisions.length, 1);
  assert(row.planRevisions[0].by);
  assert.equal((await call('tl', payload({
    requestCompletion: true,
    actualCompletion: '2026-08-18',
    expectedVersion: 0
  }))).status, 409);
});
test('PTL date captures once, assigned SPOC confirms then TD approves and returns next planning target', async () => {
  await reset();
  let row = await plan();
  for (const actualCompletion of ['2099-01-01', '2026-07-31']) assert.equal((await call('tl', payload({
    requestCompletion: true,
    actualCompletion,
    expectedVersion: row.__v
  }))).status, 400);
  row = (await action('tl', row, {
    requestCompletion: true,
    actualCompletion: '2026-08-18'
  })).item;
  assert.equal(row.actualCompletion.slice(0, 10), '2026-08-18');
  assert.equal((await call('td', payload({
    approveCompletion: true,
    expectedVersion: row.__v
  }))).status, 409);
  row = (await action('spoc', row, {
    confirmCompletion: true
  })).item;
  const result = await action('td', row, {
    approveCompletion: true
  });
  assert.equal(result.item.billingReadiness, 'Ready for billing');
  assert.equal(result.nextStage.stage, 'SD');
  assert.equal(result.nextStage.defaultStartDate, '2026-08-19');
  assert.equal((await call('tl', payload({
    stage: 'SD',
    planDates: true,
    startDate: '2026-08-17',
    plannedCompletion: '2026-09-01'
  }))).status, 400);
  const {
    Notification
  } = await import('../api/src/models/Notification.js');
  const notes = await Notification.find({
    project: f.project,
    type: 'stage-approval'
  }).sort({
    createdAt: 1
  }).lean();
  for (const n of notes) assert.equal(n.link.view, 'stage-timeline');
  assert(notes.some(n => n.title.includes('PTL') && n.users.map(String).includes(f.cast.spoc.user) && n.detail.includes('+4')));
  assert(notes.some(n => n.title.includes('SPOC') && n.users.map(String).includes(f.cast.td.user)));
  assert(notes.some(n => n.title.includes('approved') && n.roles.includes('admin_billing')));
});
test('service alias resolves existing identity; sequencing is per service; nonassigned PTLs/SPOCs fail', async () => {
  await reset();
  await f.models.Project.findByIdAndUpdate(f.project, {
    $addToSet: {
      services: 'BIM'
    }
  });
  const {
    ServiceDashboard
  } = await import('../api/src/models/ServiceDashboard.js');
  await f.models.Team.create({
    name: 'BIM stage ownership',
    service: 'BIM',
    projects: [f.project],
    lead: f.cast.outsider.employee
  });
  await ServiceDashboard.create({
    project: f.project,
    service: 'BIM',
    technicalDirector: 'TEST-td'
  });
  await f.models.StageStatus.create({
    project: f.project,
    service: 'STR',
    stage: 'CD',
    confirmationStatus: 'TD Approved',
    billingReadiness: 'Billed'
  });
  const r = await call('td', payload({
    service: 'Structural',
    stage: 'SD',
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14'
  }));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.item.service, 'STR');
  assert.equal(await f.models.StageStatus.countDocuments({
    project: f.project,
    stage: 'CD'
  }), 1);
  assert.equal((await call('td', payload({
    service: 'BIM',
    stage: 'SD',
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14'
  }))).status, 409);
  assert.equal((await call('tl', payload({
    service: 'BIM',
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14'
  }))).status, 403);
});
test('legacy approved/billed dates stay unknown, edits and alternate billing bypass rejected', async () => {
  await reset();
  const row = await f.models.StageStatus.create({
    project: f.project,
    service: 'SMEPF',
    stage: 'CD',
    confirmationStatus: 'TD Approved',
    billingReadiness: 'Billed'
  });
  assert.equal((await call('td', payload({
    approveCompletion: true
  }), 'PUT', '/api/billing/stages/' + row._id)).status, 409);
  const read = await call('td', undefined, 'GET', '/api/billing/stage-timeline?project=' + f.project);
  assert.equal(read.status, 200);
  assert.equal(read.data.items.find(x => x.stage === 'CD').actualCompletion, undefined);
  assert.equal((await call('admin', payload({
    stage: 'SD',
    billingReadiness: 'Ready for billing'
  }))).status, 403);
  assert.equal((await call('admin', payload({
    stage: 'SD',
    billingReadiness: 'Billed'
  }))).status, 403);
  const next = await plan({
    stage: 'SD'
  });
  assert.equal(next.stage, 'SD');
});
test('calendar variance +4 late, 6 overdue, -3 early, due and missing, including original baseline', async () => {
  const {
    stageMetrics
  } = await import('../api/src/utils/stageTimeline.js');
  assert.equal(stageMetrics({
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14',
    actualCompletion: '2026-08-18'
  }).variance, 4);
  assert.equal(stageMetrics({
    plannedCompletion: '2026-10-24'
  }, '2026-10-30').label, 'Overdue 6 d');
  assert.equal(stageMetrics({
    plannedCompletion: '2027-01-15',
    actualCompletion: '2027-01-12'
  }).label, '3 d early');
  assert.equal(stageMetrics({
    plannedCompletion: '2026-10-30'
  }, '2026-10-30').label, 'Due today');
  assert.equal(stageMetrics({}).label, '—');
  assert.equal(stageMetrics({
    plannedCompletion: '2026-08-17',
    baselineCompletion: '2026-08-14',
    actualCompletion: '2026-08-18'
  }).baselineVariance, 4);
});
test('IST day boundary drives due/overdue and PTL future cutoff while browser preview matches API arithmetic', async () => {
  const server = await import('../api/src/utils/stageTimeline.js'),
    browser = await import('../web/src/lib/stageTimeline.js');
  for (const dates of [server, browser]) {
    assert.equal(dates.day('2026-10-30T18:29:59.999Z'), '2026-10-30');
    assert.equal(dates.day('2026-10-30T18:30:00.000Z'), '2026-10-31');
    assert.equal(dates.stageMetrics({
      plannedCompletion: '2026-10-30'
    }, dates.day('2026-10-30T18:29:59.999Z')).label, 'Due today');
    assert.equal(dates.stageMetrics({
      plannedCompletion: '2026-10-30'
    }, dates.day('2026-10-30T18:30:00.000Z')).label, 'Overdue 1 d');
    assert.equal(dates.calendarDays('2026-10-25', '2026-10-24'), 1);
  }
});
test('legacy rows without a version can plan atomically without inventing unknown actual dates', async () => {
  await reset();
  const p = await f.models.Project.findById(f.project);
  await f.models.StageStatus.collection.insertOne({
    project: p._id,
    service: 'SMEPF',
    stage: 'CD',
    confirmationStatus: 'PTL Requested',
    billingReadiness: 'Pending'
  });
  const row = await plan();
  assert.equal(row.__v, 1);
  assert.equal(row.actualCompletion, undefined);
  const confirmed = await action('spoc', row, {
    confirmCompletion: true
  });
  const done = await action('td', confirmed.item, {
    approveCompletion: true
  });
  const billed = await call('admin', {
    project: f.project,
    service: 'SMEPF',
    stage: 'CD',
    amount: 100
  }, 'POST', '/api/billing/claims');
  assert.equal(billed.status, 201, JSON.stringify(billed.data));
  assert.equal(done.item.actualCompletion, undefined);
});
test('team membership and proposed SPOC allocation grant reads but cannot mutate, nor can unrelated TD', async () => {
  await reset();
  for (const role of ['wrongtl', 'wrongspoc', 'wrongtd']) assert.equal((await call(role, payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-14'
  }))).status, 403, role);
  let row = await plan();
  row = (await action('tl', row, {
    requestCompletion: true,
    actualCompletion: '2026-08-14'
  })).item;
  assert.equal((await call('wrongspoc', payload({
    confirmCompletion: true,
    expectedVersion: row.__v
  }))).status, 403);
  assert.equal((await call('spoc', payload({
    confirmCompletion: true,
    expectedVersion: row.__v,
    actualCompletion: '2026-08-15'
  }))).status, 400);
  assert.equal((await call('td', {
    expectedVersion: row.__v,
    service: 'BIM',
    approveCompletion: true
  }, 'PUT', '/api/billing/stages/' + row._id)).status, 400);
  const revised = await f.models.StageStatus.findById(row._id).lean();
  assert.equal(revised.confirmationStatus, 'PTL Requested');
  assert.equal(revised.actualCompletion.toISOString().slice(0, 10), '2026-08-14');
  assert.equal((await call('engineer', undefined, 'GET', '/api/billing/stage-timeline?project=' + f.other)).status, 403);
});
test('generated server and browser stage date modules match the canonical source', () => {
  execFileSync(process.execPath, ['scripts/sync-stage-dates.mjs', '--check']);
});
test('same service alias requests cannot create duplicate trackers and final GFC approval has no next popup', async () => {
  await reset();
  const original = await f.models.Project.findById(f.project).lean();
  await f.models.Project.findByIdAndUpdate(f.project, {
    $set: {
      services: ['STR'],
      scope: []
    }
  });
  let row = await plan({
    service: 'Structural'
  });
  assert.equal(row.service, 'STR');
  assert.equal((await call('tl', payload({
    service: 'STR',
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-15',
    expectedVersion: 0,
    reason: 'Stale initial form'
  }))).status, 409);
  assert.equal(await f.models.StageStatus.countDocuments({
    project: f.project,
    stage: 'CD'
  }), 1);
  await reset();
  await f.models.Project.findByIdAndUpdate(f.project, {
    $set: {
      services: original.services,
      scope: original.scope
    }
  });
  let priorActual = null;
  for (const [index, stage] of ['CD', 'SD', 'DD', 'TD', 'GFC'].entries()) {
    const actual = `2026-08-${String(index + 2).padStart(2, '0')}`;
    row = await plan({
      stage,
      startDate: priorActual ?? '2026-08-01',
      plannedCompletion: actual
    });
    row = (await action('tl', row, {
      requestCompletion: true,
      actualCompletion: actual
    })).item;
    row = (await action('spoc', row, {
      confirmCompletion: true
    })).item;
    const done = await action('atd', row, {
      approveCompletion: true
    });
    assert.equal(done.nextStage === null, stage === 'GFC');
    priorActual = actual;
  }
  const result = await call('td', undefined, 'GET', '/api/billing/stage-timeline?project=' + f.project);
  const summary = result.data.summaries.find(s => s.service === 'SMEPF');
  assert.equal(summary.completed, 5);
  assert.equal(summary.onTime, 5);
  assert.equal(summary.netVariance, 0);
  assert.equal(summary.currentStage, null);
});
test('legacy tracker without approval defaults remains plannable and exposes current PTL action', async () => {
  await reset();
  const project = await f.models.Project.findById(f.project);
  await f.models.StageStatus.collection.insertOne({
    project: project._id,
    service: 'SMEPF',
    stage: 'CD'
  });
  const row = await plan();
  assert.equal(row.__v, 1);
  const result = await call('tl', undefined, 'GET', '/api/billing/stage-timeline?project=' + f.project);
  assert.equal(result.data.items.find(r => r.stage === 'CD').permissions.request, true);
});
test('a fresh project bundle and component-labelled request resolve one tracker instead of parallel timelines', async () => {
  await reset();
  let row = await plan({
    service: 'STR'
  });
  assert.equal(row.service, 'SMEPF');
  const r = await call('tl', payload({
    planDates: true,
    startDate: '2026-08-01',
    plannedCompletion: '2026-08-15',
    expectedVersion: 0,
    reason: 'Stale bundle form'
  }));
  assert.equal(r.status, 409);
  assert.equal(await f.models.StageStatus.countDocuments({
    project: f.project,
    stage: 'CD'
  }), 1);
});
test('next-stage target retains a legacy saved baseline so the popup requests a reasoned revision', async () => {
  await reset();
  let row = await plan();
  await f.models.StageStatus.create({
    project: f.project,
    service: 'SMEPF',
    stage: 'SD',
    startDate: '2026-08-19',
    plannedCompletion: '2026-09-01',
    baselineStartDate: '2026-08-19',
    baselineCompletion: '2026-08-30'
  });
  row = (await action('tl', row, {
    requestCompletion: true,
    actualCompletion: '2026-08-18'
  })).item;
  row = (await action('spoc', row, {
    confirmCompletion: true
  })).item;
  const done = await action('td', row, {
    approveCompletion: true
  });
  assert.equal(done.nextStage.startDate.slice(0, 10), '2026-08-19');
  assert.equal(done.nextStage.baselineCompletion.slice(0, 10), '2026-08-30');
  assert.equal(done.nextStage.plannedCompletion.slice(0, 10), '2026-09-01');
});
