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
      port: 5179,
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
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const login = await context.request.post(
    'http://127.0.0.1:5179/api/auth/login',
    { data: { email: f.cast.engineer.email, password: f.password } },
  );
  assert(login.ok());
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5179/travel-booking/new');
  await expect(
    page.getByRole('heading', { name: 'New travel booking' }),
  ).toBeVisible();
  await page
    .getByLabel('Employee *', { exact: true })
    .selectOption(f.cast.outsider.employee);
  await page.getByLabel('To city *', { exact: true }).fill('Browser city');
  await page.getByLabel('Departure date *', { exact: true }).fill('2098-11-03');
  await page.getByLabel('Return date *', { exact: true }).fill('2098-11-04');
  await page.getByLabel('Mode', { exact: true }).selectOption('Flight');
  await page.getByLabel('Hotel', { exact: true }).fill('Browser hotel');
  await page.getByLabel('Flight fare (₹)').fill('100.10');
  await page.getByLabel('Hotel amount (₹)').fill('50.20');
  await expect(page.getByLabel('Check-in', { exact: true })).toHaveValue(
    '2098-11-03',
  );
  await page.getByRole('button', { name: 'Add booking', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Travel booking added.');
  const row = page.locator('.travel-row').filter({ hasText: 'Browser city' });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Reschedule', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reschedule travel booking' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('To city *', { exact: true })).toHaveValue(
    'Browser city',
  );
  await page
    .getByLabel('To city *', { exact: true })
    .fill('Revised browser city');
  await page
    .getByLabel('Reason for reschedule *')
    .selectOption('Site not ready');
  await page.getByLabel('New flight amount', { exact: false }).fill('120.25');
  await page.getByRole('button', { name: 'Save new dates' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'New dates saved. Booking rescheduled.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'No horizontal scroll on mobile',
  );
  await page.screenshot({
    path: '/tmp/travel-oct30-mobile.png',
    animations: 'disabled',
    fullPage: true,
  });
  await row.getByRole('link', { name: 'Cancel trip', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cancel trip', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Reason for cancelling *')
    .selectOption('Project postponed');
  await page.getByRole('button', { name: 'Cancel this trip' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Trip cancelled. Fees and refunds are recorded.',
  );
  await expect(
    page.locator('.travel-status').filter({ hasText: 'Cancelled' }),
  ).toBeVisible();
  await expect(
    row.getByRole('link', { name: 'Reschedule', exact: true }),
  ).toHaveCount(0);
  const readonly = await browser.newContext();
  await readonly.request.post('http://127.0.0.1:5179/api/auth/login', {
    data: { email: f.cast.md.email, password: f.password },
  });
  const director = await readonly.newPage();
  director.on('pageerror', (e) => errors.push(e.message));
  await director.goto('http://127.0.0.1:5179/travel-booking');
  await expect(director.locator('.travel-row')).toHaveCount(1);
  await expect(
    director.getByRole('link', { name: 'Edit', exact: true }),
  ).toHaveCount(0);
  await director.goto('http://127.0.0.1:5179/travel-booking/new');
  await expect(
    director.getByText('Directors have read-only access to travel bookings.'),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: shared non-director add/reschedule/refresh/cancel; director view-only/deep-link guard; mobile no horizontal scrolling; no page errors.',
  );
} finally {
  await browser?.close();
  await vite?.close();
  await f.stop();
}
