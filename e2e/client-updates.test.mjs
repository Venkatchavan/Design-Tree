import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';
let f;
const cookies = {};
async function call(role, path, method = 'GET', body) {
  const res = await fetch(f.base + path, {
    method,
    headers: {
      Cookie: cookies[role],
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
before(async () => {
  f = await startLocalFixture();
  for (const [key, user] of Object.entries(f.cast)) {
    const res = await fetch(f.base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: f.password }),
    });
    assert.equal(res.status, 200, key);
    cookies[key] = res.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => {
  await f?.stop();
});

test('Admin fields round-trip; edits record actor, time and before/after history', async () => {
  const create = await call('admin', '/api/projects', 'POST', {
    name: 'Audit project',
    code: 'CLIENT-AUDIT',
    jobNumber: 'WO/CLIENT/1',
    branch: 'Test HQ',
    sourcePerson: 'Referral person',
    referral: 'Referral detail',
    startDate: '2026-10-01',
    expectedCompletion: '2027-01-01',
    actualCompletion: '2026-12-31',
    contacts: { client: { name: 'Existing client' } },
  });
  assert.equal(create.status, 201, JSON.stringify(create.data));
  const p = create.data.project;
  assert.equal(p.sourcePerson, 'Referral person');
  assert.equal(p.actualCompletion.slice(0, 10), '2026-12-31');
  assert.equal(
    (
      await call('admin', `/api/projects/${p._id}`, 'PUT', {
        sourcePerson: 'Corrected person',
        actualCompletion: null,
      })
    ).status,
    200,
  );
  const history = await call('admin', `/api/projects/${p._id}/history`);
  assert.equal(history.status, 200);
  assert.equal(
    history.data.items.filter((r) => r.recordType === 'Project').length,
    2,
  );
  const edit = history.data.items.find((x) => x.action === 'Updated');
  assert.equal(edit.actorName, 'Test admin');
  assert(!Number.isNaN(Date.parse(edit.at)));
  assert(
    edit.changes.some(
      (c) =>
        c.field === 'sourcePerson' &&
        c.previous === 'Referral person' &&
        c.updated === 'Corrected person',
    ),
  );
  assert.equal(
    (await call('spoc', `/api/projects/${p._id}/history`)).status,
    403,
  );
  assert.equal(
    (
      await call('md', `/api/projects/${p._id}`, 'PUT', {
        name: 'Forbidden edit',
      })
    ).status,
    403,
  );
});

test('Project audit is append-only and records related project rows', async () => {
  const create = await call('tl', '/api/work/deliverables', 'POST', {
    project: f.project,
    deliverable: 'Audited deliverable',
    stage: 'CD',
  });
  assert.equal(create.status, 201, JSON.stringify(create.data));
  const id = create.data.item._id;
  assert.equal(
    (
      await call('tl', `/api/work/deliverables/${id}`, 'PUT', {
        deliverable: 'Audited correction',
      })
    ).status,
    200,
  );
  const history = await call('admin', `/api/projects/${f.project}/history`);
  assert(
    history.data.items.some(
      (r) =>
        r.recordType === 'Deliverable' &&
        r.changes.some(
          (c) =>
            c.previous === 'Audited deliverable' &&
            c.updated === 'Audited correction',
        ),
    ),
  );
  const audit = await f.models.ProjectAudit.findOne({ project: f.project });
  await assert.rejects(
    () =>
      f.models.ProjectAudit.updateOne(
        { _id: audit._id },
        { $set: { actorName: 'Overwrite' } },
      ),
    /append-only/,
  );
  await assert.rejects(
    () => f.models.ProjectAudit.deleteOne({ _id: audit._id }),
    /append-only/,
  );
  await assert.rejects(
    () =>
      f.models.ProjectAudit.bulkWrite([
        { deleteOne: { filter: { _id: audit._id } } },
      ]),
    /append-only/,
  );
});

test('SPOC contacts persist and Admin updates retain Client, Architect, Billing and SPOC records', async () => {
  assert.equal(
    (
      await call('admin', `/api/projects/${f.project}`, 'PUT', {
        contacts: {
          client: { name: 'Client' },
          architect: { name: 'Architect' },
          billing: { name: 'Billing' },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call('spoc', `/api/projects/${f.project}/spoc-contacts`, 'PUT', {
        pmc: { name: 'PMC' },
        peerReview: { name: 'Peer contact' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call('admin', `/api/projects/${f.project}`, 'PUT', {
        contacts: { client: { name: 'Corrected client' } },
      })
    ).status,
    200,
  );
  const p = (await call('spoc', `/api/projects/${f.project}`)).data.project;
  assert.equal(p.contacts.pmc.name, 'PMC');
  assert.equal(p.contacts.peerReview.name, 'Peer contact');
  assert.equal(p.contacts.architect.name, 'Architect');
  assert.equal(p.contacts.billing.name, 'Billing');
  assert.equal(
    (
      await call('admin', `/api/projects/${f.project}`, 'PUT', {
        contacts: { pmc: { name: 'Spoof' } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('spoc', `/api/projects/${f.other}/spoc-contacts`, 'PUT', {
        pmc: { name: 'Unauthorized' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call('spoc', `/api/projects/${f.project}/spoc-contacts`, 'PUT', {
        pmc: null,
      })
    ).status,
    200,
  );
});

test('Project coordination entry persists, flags overdue by service, stays project-scoped and resolves', async () => {
  const c = await call('spoc', '/api/coordination-items', 'POST', {
    project: f.project,
    channel: 'Internal team',
    service: 'Structural',
    topic: 'Client coordination check',
    deadline: '2020-01-01',
  });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const id = c.data.item._id;
  let rows = (
    await call('tl', `/api/coordination-items?project=${f.project}&service=STR`)
  ).data.items;
  assert(rows.some((r) => r._id === id && new Date(r.deadline) < new Date()));
  assert.equal(
    (await call('spoc', `/api/coordination-items?project=${f.other}`)).data
      .items.length,
    0,
  );
  assert.equal(
    (await call('outsider', '/api/coordination-items')).data.items.length,
    0,
  );
  assert.equal(
    (
      await call('spoc', '/api/coordination-items', 'POST', {
        project: f.other,
        channel: 'Client',
        service: 'Structural',
        topic: 'Forbidden',
        deadline: '2026-11-01',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('spoc', `/api/coordination-items/${id}`, 'PUT', {
        status: 'Resolved',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call('tl', `/api/coordination-items/${id}`, 'PUT', {
        status: 'Open',
      })
    ).status,
    403,
  );
});

test('Every director is read-only in Finance including direct mutations and file routes', async () => {
  const made = await call('finance', '/api/finance-occ', 'POST', {
    kind: 'po',
    project: f.project,
    employee: f.cast.finance.employee,
    amount: 120,
    purpose: 'Read-only verification',
  });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const id = made.data.item._id;
  for (const role of ['md', 'wd', 'ed', 'associate', 'td', 'atd']) {
    for (const [method, path, body] of [
      [
        'POST',
        '/api/finance-occ',
        { kind: 'po', employee: f.cast.finance.employee },
      ],
      ['PUT', `/api/finance-occ/${id}`, { amount: 999 }],
      ['PATCH', `/api/finance-occ/${id}/decision`, { status: 'Approved' }],
      ['DELETE', `/api/finance-occ/${id}`],
      ['POST', `/api/documents/finance-occ/${id}/files`],
    ]) {
      assert.equal(
        (await call(role, path, method, body)).status,
        403,
        `${role} ${method} ${path}`,
      );
    }
  }
  assert.equal(
    (await call('finance', `/api/finance-occ/${id}`, 'PUT', { amount: 125 }))
      .status,
    200,
  );
  assert.equal(
    (
      await call('admin', `/api/billing/projects/${f.project}/quote`, 'PATCH', {
        quotedFee: 1234,
      })
    ).status,
    200,
  );
  for (const role of ['md', 'wd', 'ed'])
    assert.equal(
      (
        await call(role, `/api/billing/projects/${f.project}/quote`, 'PATCH', {
          quotedFee: 1,
        })
      ).status,
      403,
    );
});

test('Marketing excludes Admin-created and legacy projects in list, counts and brief access', async () => {
  const rows = await call('marketing', '/api/marketing/portfolio');
  assert.equal(rows.status, 200);
  assert(rows.data.items.some((p) => p.name === 'Marketing-owned portfolio'));
  assert(!rows.data.items.some((p) => p.id === f.project));
  assert.equal(rows.data.summary.portfolio, rows.data.items.length);
  assert.equal(
    (await call('marketing', `/api/marketing/brief?project=${f.project}`))
      .status,
    404,
  );
  const p = await call('admin', '/api/projects', 'POST', {
    name: 'Hidden new Admin project',
    code: 'HIDDEN-ADMIN',
    origin: 'marketing',
  });
  assert.equal(p.status, 201);
  assert.equal(
    p.data.project.origin,
    'admin_billing',
    'Clients cannot spoof project provenance',
  );
  assert(
    !(await call('marketing', '/api/marketing/portfolio')).data.items.some(
      (row) => row.id === p.data.project._id,
    ),
  );
});

test('Peer dashboard uses live assignments and exposes one Work Tracking path', async () => {
  for (const role of ['peer', 'peerhead']) {
    const boot = (await call(role, '/api/meta/bootstrap')).data;
    assert.equal(boot.home, 'peer-dashboard');
    assert(
      !boot.nav.some((n) =>
        ['work-tracking', 'update-work-progress'].includes(n.view),
      ),
    );
    const dashboard = await call(role, '/api/projects/peer-dashboard');
    assert.equal(dashboard.status, 200);
    assert(
      dashboard.data.items.some(
        (p) => p._id === f.project && p.pendingReviews === 1,
      ),
    );
    assert(!dashboard.data.items.some((p) => p._id === f.other));
  }
  assert.equal((await call('peer', `/api/projects/${f.other}`)).status, 404);
});

test('SPOC approved roster reaches TL; editing Nominated by updates one existing row', async () => {
  const rows = [
    {
      service: 'STR',
      employee: f.cast.tl.employee,
      name: 'TL',
      approvalStatus: 'Approved',
    },
    {
      service: 'Structural',
      employee: f.cast.engineer.employee,
      name: 'Engineer',
      approvalStatus: 'Approved',
    },
  ];
  assert.equal(
    (
      await call('spoc', `/api/projects/${f.project}/team-leads`, 'PUT', {
        principalTeamLeads: rows,
      })
    ).status,
    200,
  );
  rows[1].nominatedBy = 'Director confirmation';
  assert.equal(
    (
      await call('spoc', `/api/projects/${f.project}/team-leads`, 'PUT', {
        principalTeamLeads: rows,
      })
    ).status,
    200,
  );
  const p = (await call('spoc', `/api/projects/${f.project}`)).data.project;
  assert.equal(p.principalTeamLeads.length, 2);
  assert.equal(p.principalTeamLeads[1].nominatedBy, 'Director confirmation');
  const teams = await call('tl', '/api/teams/mine');
  assert.equal(teams.data.items[0].allocationProject,f.project,'Current confirmed team must precede legacy rosters');
  assert.equal(teams.status, 200);
  assert(
    teams.data.items.some((t) =>
      (t.members ?? []).some(
        (m) => m.employee._id === f.cast.engineer.employee,
      ),
    ),
  );

  const roster = await call('tl', '/api/projects/' + f.project + '/team');
  assert(
    roster.data.members.some(
      (m) => m.employee._id === f.cast.engineer.employee,
    ),
  );
  const task = await call('tl', '/api/work/tasks', 'POST', {
    project: f.project,
    members: [f.cast.engineer.employee],
    deliverable: 'Confirmed roster assignment',
  });
  assert.equal(task.status, 201, JSON.stringify(task.data));
  assert.equal(task.data.item.createdBy, f.cast.tl.user);
});
