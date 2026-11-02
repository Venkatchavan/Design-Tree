import { execFileSync } from 'node:child_process';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalFixture } from './local-fixture.mjs';
import { ROLE_KEYS, DIRECTOR_ROLES } from '../api/src/config/roles.js';
let f;
const cookies = {};
before(async () => {
  f = await startLocalFixture();
  const sample = await f.models.User.findById(f.cast.admin.user)
    .select('+passwordHash')
    .lean();
  for (const role of ROLE_KEYS) {
    const user = await f.models.User.create({
      name: role,
      email: role + '@travel.example',
      role,
      passwordHash: sample.passwordHash,
      employee: f.cast.admin.employee,
    });
    const r = await fetch(f.base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: f.password }),
    });
    cookies[role] = r.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => f?.stop());
async function call(role, path = '', method = 'GET', body) {
  const r = await fetch(f.base + '/api/travel-bookings' + path, {
    method,
    headers: { Cookie: cookies[role], 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
const body = () => ({
  employee: f.cast.engineer.employee,
  toCity: 'Mumbai',
  departureDate: '2098-11-03',
  returnDate: '2098-11-04',
  mode: 'Flight',
  hotel: 'Test hotel',
  hotelDatesSameAsTravel: true,
  transportFare: '100.10',
  hotelAmount: '50.20',
});
async function create() {
  const r = await call('finance', '', 'POST', body());
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.item;
}
test('every internal role reads shared log; directors read only; externals excluded', async () => {
  const existing = await create();
  for (const role of ROLE_KEYS) {
    const external = ['client', 'architect'].includes(role),
      writer = !external && !DIRECTOR_ROLES.includes(role);
    assert.equal(
      (await call(role)).status,
      external ? 403 : 200,
      role + ' read',
    );
    const bootstrap = await fetch(f.base + '/api/meta/bootstrap', {
      headers: { Cookie: cookies[role] },
    }).then((r) => r.json());
    assert.equal(
      bootstrap.nav.some((n) => n.view === 'travel-booking'),
      !external,
      role + ' nav',
    );
    assert.equal(
      (await call(role, '', 'POST', body())).status,
      writer ? 201 : 403,
      role + ' create',
    );
    assert.equal(
      (
        await call(role, '/' + existing._id, 'PUT', {
          expectedVersion: existing.__v,
          reason: 'Shared edit',
        })
      ).status,
      writer ? 200 : 403,
      role + ' edit',
    );
    if (writer) existing.__v++;
    for (const operation of ['reschedule', 'cancel'])
      assert.equal(
        (await call(role, '/' + existing._id + '/' + operation, 'POST', {}))
          .status,
        writer ? 400 : 403,
        role + ' ' + operation,
      );
    assert.equal(
      (
        await call(role, '/' + existing._id + '/status', 'PATCH', {
          status: 'Confirmed',
        })
      ).status,
      writer ? 405 : 403,
      role + ' status bypass',
    );
    assert.equal(
      (await call(role, '/' + existing._id, 'DELETE')).status,
      external || DIRECTOR_ROLES.includes(role) ? 403 : 405,
      role + ' delete',
    );
  }
});
test('required dates, calendar dates, order, hotel range and decimal money validated', async () => {
  for (const fields of [
    { employee: undefined },
    { toCity: '' },
    { departureDate: undefined },
    { departureDate: '2098-02-30' },
    { returnDate: '2098-11-02' },
    {
      hotelDatesSameAsTravel: false,
      checkIn: '2098-11-04',
      checkOut: '2098-11-03',
    },
    { transportFare: '1.001' },
    { hotelAmount: -1 },
  ]) {
    assert.equal(
      (await call('finance', '', 'POST', { ...body(), ...fields })).status,
      400,
      JSON.stringify(fields),
    );
  }
});
test('reschedules accumulate exact separate costs and immutable history, cancellation retains earlier fees', async () => {
  let b = await create();
  const id = '/' + b._id;
  const change = {
    expectedVersion: b.__v,
    changes: {
      toCity: 'Delhi',
      departureDate: '2098-11-05',
      returnDate: '2098-11-06',
    },
    reason: 'Site not ready',
    transport: { originalAmount: '100.10', newAmount: '120.25', fee: '5.10' },
    stay: { originalAmount: '50.20', newAmount: '40.10', fee: '2.20' },
  };
  let r = await call('engineer_drafter', id + '/reschedule', 'POST', change);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  b = r.data.item;
  assert.equal(b.history.length, 1);
  assert.equal(b.history[0].transport.differenceMinor, 2015);
  assert.equal(b.history[0].stay.differenceMinor, -1010);
  assert.equal(b.costs.extraCostMinor, 1735);
  assert.equal(b.checkIn, '2098-11-05');
  assert(b.history[0].actor && b.history[0].at);
  const first = b.history[0];
  assert.equal(
    (await call('finance', id + '/reschedule', 'POST', change)).status,
    409,
  );
  r = await call('finance', id + '/reschedule', 'POST', {
    ...change,
    expectedVersion: b.__v,
    changes: { preferredSeat: 'Window' },
    transport: { originalAmount: '120.25', fee: '0.01' },
    stay: { originalAmount: '40.10' },
  });
  assert.equal(r.status, 200);
  b = r.data.item;
  assert.equal(b.costs.extraCostMinor, 1736);
  assert.deepEqual(b.history[0], first);
  assert.equal(
    (
      await call('finance', id + '/cancel', 'POST', {
        expectedVersion: b.__v,
        reason: 'Project postponed',
        transport: { amountPaid: '120.25', fee: '121' },
      })
    ).status,
    400,
  );
  r = await call('coordinator', id + '/cancel', 'POST', {
    expectedVersion: b.__v,
    reason: 'Project postponed',
    transport: { amountPaid: '120.25', fee: '10.05' },
    stay: { amountPaid: '40.10', fee: '2.10' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  b = r.data.item;
  assert.equal(b.cancellation.totalRefundMinor, 14820);
  assert.equal(b.cancellation.notRefundedMinor, 1215);
  assert.equal(b.cancellation.previousFeesMinor, 731);
  assert.equal(b.history.length, 3);
  assert.equal(
    (
      await call('finance', id + '/cancel', 'POST', {
        expectedVersion: b.__v,
        reason: 'Other',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call('finance', id, 'PUT', {
        expectedVersion: b.__v,
        status: 'Confirmed',
      })
    ).status,
    400,
  );
  r = await call('admin_billing', id, 'PUT', {
    expectedVersion: b.__v,
    reason: 'Administrative correction',
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.item.status, 'Cancelled');
  assert.deepEqual(r.data.item.history, b.history);
  assert.equal(
    (
      await call('finance', id, 'PUT', {
        expectedVersion: r.data.item.__v,
        employee: f.cast.admin.employee,
      })
    ).status,
    400,
  );
});
test('reschedule needs meaningful change/reason; missing, underway, past and cancelled starts cannot operate', async () => {
  const b = await create(),
    id = '/' + b._id;
  assert.equal(
    (
      await call('finance', id + '/reschedule', 'POST', {
        expectedVersion: 0,
        changes: { toCity: 'Mumbai' },
        reason: 'Other',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('finance', id + '/reschedule', 'POST', {
        expectedVersion: 0,
        changes: { toCity: 'Delhi' },
        reason: '',
      })
    ).status,
    400,
  );
  const { TravelBooking } = await import('../api/src/models/TravelBooking.js');
  for (const fields of [
    { returnDate: new Date('2000-01-02') },
    {
      departureDate: new Date('2000-01-01'),
      returnDate: new Date('2099-01-01'),
    },
    { departureDate: undefined },
  ]) {
    const x = await TravelBooking.create({ ...body(), ...fields });
    assert.equal(
      (
        await call('finance', '/' + x._id + '/cancel', 'POST', {
          expectedVersion: 0,
          reason: 'Other',
        })
      ).status,
      400,
    );
  }
});

test('legacy missing dates and amounts stay unknown on reads and ordinary edits; version conflicts are atomic', async () => {
  const { TravelBooking } = await import('../api/src/models/TravelBooking.js');
  const b = await TravelBooking.create({
    employee: f.cast.engineer.employee,
    hotel: 'Legacy hotel',
    toCity: 'Delhi',
    returnDate: '2000-01-01',
    status: 'Completed',
  });
  const r = await call('finance', '/' + b._id);
  assert.equal(r.data.item.displayStatus, 'Travelled');
  assert.equal(r.data.item.transportFare, undefined);
  assert.equal(r.data.item.checkIn, undefined);
  const writes = await Promise.all(
    ['A', 'B'].map((reason) =>
      call('engineer_drafter', '/' + b._id, 'PUT', {
        expectedVersion: 0,
        reason,
      }),
    ),
  );
  assert.deepEqual(writes.map((r) => r.status).sort(), [200, 409]);
  const saved = await TravelBooking.findById(b._id).lean();
  assert.equal(saved.departureDate, undefined);
  assert.equal(saved.transportFare, undefined);
  assert.equal(saved.hotelDatesSameAsTravel, undefined);
  assert.equal(saved.history, undefined);
});
test('Kolkata day boundaries and browser/server money formulas agree exactly', async () => {
  const server = await import('../api/src/utils/travelBooking.js'),
    browser = await import('../web/src/lib/travelBooking.js');
  assert.equal(server.day('2026-10-30T18:29:59.999Z'), '2026-10-30');
  assert.equal(server.day('2026-10-30T18:30:00.000Z'), '2026-10-31');
  for (const module of [server, browser]) {
    assert.throws(
      () => module.rescheduleCost({ originalAmount: '1' }, '0.00'),
      /saved current amount/,
    );
    assert.throws(
      () => module.cancellationCost({ amountPaid: '' }, '0.00'),
      /saved current amount/,
    );
    assert.equal(
      module.rescheduleCost({ originalAmount: '1.01', newAmount: '1.02' })
        .differenceMinor,
      1,
    );
    assert.equal(module.hasKnownAmount(null), false);
    assert.equal(module.hasKnownAmount(''), false);
    assert.equal(module.hasKnownAmount('0.00'), true);
    assert.deepEqual(
      module.rescheduleCost({
        originalAmount: '0.10',
        newAmount: '0.30',
        fee: '0.01',
      }),
      {
        originalMinor: 10,
        newMinor: 30,
        feeMinor: 1,
        differenceMinor: 20,
        extraCostMinor: 21,
      },
    );
    assert.equal(
      module.upcoming(
        { departureDate: '2026-10-30', returnDate: '2026-10-31' },
        '2026-10-30',
      ),
      false,
    );
    assert.equal(
      module.bookingStatus({ status: 'Cancelled', returnDate: '2000-01-01' }),
      'Cancelled',
    );
  }
});

test('generated service-local travel utilities match their canonical source', () => {
  execFileSync(process.execPath, [
    'scripts/sync-travel-booking.mjs',
    '--check',
  ]);
});

test('full booking list pagination and invalid pages keep shared log complete', async () => {
  const { TravelBooking } = await import('../api/src/models/TravelBooking.js');
  await TravelBooking.insertMany(
    Array.from({ length: 205 }, (_, i) => ({
      employee: f.cast.engineer.employee,
      toCity: 'Pagination ' + i,
    })),
  );
  const first = await call('engineer_drafter', '?page=1&limit=200'),
    second = await call('engineer_drafter', '?page=2&limit=200');
  assert.equal(first.data.items.length, 200);
  assert(first.data.hasMore);
  assert.equal(
    first.data.items.length + second.data.items.length,
    first.data.total,
  );
  assert.equal(
    new Set([...first.data.items, ...second.data.items].map((x) => x._id)).size,
    first.data.total,
  );
  for (const query of ['?page=0', '?limit=-1', '?page=1.5', '?page=Infinity'])
    assert.equal((await call('finance', query)).status, 400);
});

test('hotel removal retains paid stay through later reschedule and cancellation', async () => {
  for (const method of ['PUT', 'POST']) {
    let b = await create();
    const path = '/' + b._id;
    const r = await call(
      'finance',
      path + (method === 'POST' ? '/reschedule' : ''),
      method,
      method === 'POST'
        ? {
            expectedVersion: 0,
            changes: { hotel: '' },
            reason: 'Site not ready',
          }
        : { expectedVersion: 0, hotel: '' },
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    b = r.data.item;
    assert.equal(b.hotelAmount, '50.20');
    const history = b.history;
    const moved = await call('finance', path + '/reschedule', 'POST', {
      expectedVersion: b.__v,
      changes: { toCity: 'Delhi' },
      reason: 'Other',
      stay: { fee: '0.10' },
    });
    assert.equal(moved.status, 200, JSON.stringify(moved.data));
    b = moved.data.item;
    assert.equal(b.history.at(-1).stay.originalMinor, 5020);
    assert.equal(b.hotelAmount, '50.20');
    const cancelled = await call('finance', path + '/cancel', 'POST', {
      expectedVersion: b.__v,
      reason: 'Project postponed',
      stay: { amountPaid: '50.20', fee: '2.10' },
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.equal(cancelled.data.item.cancellation.stay.paidMinor, 5020);
    assert.equal(cancelled.data.item.cancellation.stay.refundMinor, 4810);
    assert.equal(cancelled.data.item.hotelAmount, '50.20');
    if (history)
      assert.deepEqual(
        cancelled.data.item.history.slice(0, history.length),
        history,
      );
  }
});
test('known saved fares reject cleared or conflicting operation baselines across repeated changes', async () => {
  let b = await create();
  const path = '/' + b._id;
  for (const value of ['0', '', '99.99']) {
    const r = await call('finance', path + '/reschedule', 'POST', {
      expectedVersion: 0,
      changes: { toCity: 'Delhi' },
      reason: 'Other',
      transport: { originalAmount: value, newAmount: '120.25' },
    });
    assert.equal(r.status, 400, JSON.stringify(r.data));
  }
  let r = await call('finance', path + '/reschedule', 'POST', {
    expectedVersion: 0,
    changes: { toCity: 'Delhi' },
    reason: 'Other',
    transport: { newAmount: '120.25' },
  });
  assert.equal(r.status, 200);
  b = r.data.item;
  assert.equal(b.costs.differenceMinor, 2015);
  const history = b.history;
  r = await call('finance', path + '/reschedule', 'POST', {
    expectedVersion: b.__v,
    changes: { preferredSeat: 'Window' },
    reason: 'Other',
    transport: { originalAmount: '100.10', newAmount: '130.00' },
  });
  assert.equal(r.status, 400);
  for (const value of ['0', '', '100.10']) {
    r = await call('finance', path + '/cancel', 'POST', {
      expectedVersion: b.__v,
      reason: 'Other',
      transport: { amountPaid: value },
    });
    assert.equal(r.status, 400, JSON.stringify(r.data));
  }
  r = await call('finance', path + '/cancel', 'POST', {
    expectedVersion: b.__v,
    reason: 'Other',
    stay: { amountPaid: '0' },
  });
  assert.equal(r.status, 400);
  r = await call('finance', path + '/cancel', 'POST', {
    expectedVersion: b.__v,
    reason: 'Other',
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.item.cancellation.totalRefundMinor, 17045);
  assert.deepEqual(r.data.item.history.slice(0, 1), history);
});
test('unknown legacy amounts may be initialized explicitly and retained in typed event snapshots', async () => {
  const { TravelBooking } = await import('../api/src/models/TravelBooking.js');
  for (const operation of ['reschedule', 'cancel']) {
    const b = await TravelBooking.create({
      employee: f.cast.engineer.employee,
      toCity: 'Mumbai',
      departureDate: '2098-11-03',
      returnDate: '2098-11-04',
      hotel: 'Legacy hotel',
    });
    const payload =
      operation === 'reschedule'
        ? {
            changes: { toCity: 'Delhi' },
            transport: { originalAmount: '100.10', newAmount: '120.25' },
            stay: { originalAmount: '50.20' },
          }
        : {
            transport: { amountPaid: '100.10', fee: '0.10' },
            stay: { amountPaid: '50.20' },
          };
    const r = await call('finance', '/' + b._id + '/' + operation, 'POST', {
      expectedVersion: 0,
      reason: 'Other',
      ...payload,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(
      r.data.item.history[0].transport[
        operation === 'reschedule' ? 'originalMinor' : 'paidMinor'
      ],
      10010,
    );
    assert.equal(
      r.data.item.history[0].stay[
        operation === 'reschedule' ? 'originalMinor' : 'paidMinor'
      ],
      5020,
    );
  }
});
test('missing, null, empty and whitespace-only optional text cannot manufacture reschedule fees', async () => {
  const { TravelBooking } = await import('../api/src/models/TravelBooking.js');
  for (const value of [undefined, null, '', '  ']) {
    const b = await TravelBooking.create({ ...body(), fromCity: value });
    const r = await call('finance', '/' + b._id + '/reschedule', 'POST', {
      expectedVersion: 0,
      changes: { fromCity: '' },
      reason: 'Other',
      transport: { fee: '5' },
    });
    assert.equal(r.status, 400, JSON.stringify(r.data));
    const saved = await TravelBooking.findById(b._id).lean();
    assert.equal(saved.__v, 0);
    assert.equal(saved.history, undefined);
    assert.equal(saved.fromCity, value == null ? value : value.trim());
    const moved = await call('finance', '/' + b._id + '/reschedule', 'POST', {
      expectedVersion: 0,
      changes: { fromCity: '', toCity: 'Delhi' },
      reason: 'Other',
    });
    assert.equal(moved.status, 200, JSON.stringify(moved.data));
    const savedAfter = await TravelBooking.findById(b._id).lean();
    assert.equal(savedAfter.fromCity, value == null ? value : value.trim());
  }
});
