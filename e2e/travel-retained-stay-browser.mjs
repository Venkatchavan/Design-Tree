// Focused regression: unknown stay fare must not become a displayed zero after cancellation/edit.
import { startLocalFixture } from './local-fixture.mjs';
import { createServer } from '../web/node_modules/vite/dist/node/index.js';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const f = await startLocalFixture();
let vite, browser;
try {
  vite = await createServer({
    root: resolve('web'),
    configFile: resolve('web/vite.config.js'),
    server: {
      host: '127.0.0.1',
      port: 5181,
      strictPort: true,
      proxy: { '/api': f.base, '/socket.io': { target: f.base, ws: true } },
    },
  });
  await vite.listen();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext();
  const base = 'http://127.0.0.1:5181';
  const login = await context.request.post(base + '/api/auth/login', {
    data: { email: f.cast.engineer.email, password: f.password },
  });
  assert(login.ok());
  const { TravelBooking } = await import('../api/src/models/TravelBooking.js');
  for (const [city, hotelAmount, paid] of [
    ['Unknown stay amount', undefined, '50.20'],
    ['Known zero stay amount', '0.00', '0.00'],
  ]) {
    const booking = await TravelBooking.create({
      employee: f.cast.engineer.employee,
      toCity: city,
      departureDate: '2098-11-03',
      returnDate: '2098-11-04',
      hotel: 'Legacy hotel',
      hotelAmount,
    });
    const path = base + '/api/travel-bookings/' + booking._id;
    const cancel = await context.request.post(path + '/cancel', {
      data: { expectedVersion: 0, reason: 'Other', stay: { amountPaid: paid } },
    });
    assert.equal(cancel.status(), 200, await cancel.text());
    const edit = await context.request.put(path, {
      data: { expectedVersion: 1, hotel: '' },
    });
    assert.equal(edit.status(), 200, await edit.text());
    const saved = await TravelBooking.findById(booking._id).lean();
    assert.equal(saved.hotelAmount, hotelAmount);
    assert.equal(
      saved.cancellation.stay.paidMinor,
      city === 'Unknown stay amount' ? 5020 : 0,
    );
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/travel-booking');
  const unknown = page
    .locator('.travel-row')
    .filter({ hasText: 'Unknown stay amount' });
  const knownZero = page
    .locator('.travel-row')
    .filter({ hasText: 'Known zero stay amount' });
  await expect(
    unknown.getByText(
      'Recorded stay costs retained; current amount not added.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    unknown.getByText('Recorded stay amount ₹0.00 retained.', { exact: true }),
  ).toHaveCount(0);
  await expect(
    knownZero.getByText('Recorded stay amount ₹0.00 retained.', {
      exact: true,
    }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: legacy cancellation + ordinary hotel removal preserves unknown label; known-zero retained amount still displays ₹0.00; saved unknown amount and paid 5020-paise history preserved; no page errors.',
  );
} finally {
  await browser?.close();
  await vite?.close();
  await f.stop();
}
