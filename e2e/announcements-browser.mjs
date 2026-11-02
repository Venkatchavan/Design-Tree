import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createServer } from '../web/node_modules/vite/dist/node/index.js';
import { startLocalFixture } from './local-fixture.mjs';

const output = process.env.TEST_ARTIFACT_DIR;
assert(output && resolve(output).includes('planning-2026-10-22'), 'Keep browser evidence outside Git.');
await mkdir(output, { recursive: true });
const f = await startLocalFixture();
const vite = await createServer({ root: resolve(import.meta.dirname, '../web'), configFile: resolve(import.meta.dirname, '../web/vite.config.js'), server: { host: '127.0.0.1', port: 0, strictPort: false, proxy: { '/api': f.base, '/socket.io': { target: f.base, ws: true } } } });
await vite.listen();
const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const admin = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const staff = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  for (const [context, key] of [[admin, 'admin'], [staff, 'engineer']]) {
    const r = await context.request.post(url + '/api/auth/login', { data: { email: f.cast[key].email, password: f.password } });
    assert.equal(r.status(), 200);
  }
  const page = await admin.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url + '/announcements');
  await page.getByRole('button', { name: 'New announcement' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Coordination meeting across all branches');
  await page.getByLabel('Message', { exact: true }).fill('Please join the coordination meeting at 10 AM.\n<script>window.announcementInjected=true</script>');
  await page.getByLabel('Ask each recipient to acknowledge this notice').check();
  await page.getByRole('button', { name: 'Preview audience' }).click();
  await expect(page.getByRole('heading', { name: /staff accounts/ })).toBeVisible();
  await page.getByLabel('I reviewed the message and recipient counts.').check();
  await page.screenshot({ path: resolve(output, 'compose-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Send to all branches' }).click();
  await page.waitForURL(/\/announcements\/[a-f\d]{24}$/);
  const id = page.url().split('/').pop();
  await expect(page.getByRole('button', { name: 'Acknowledge notice' })).toBeVisible();
  await expect.poll(async () => (await (await admin.request.get(url + `/api/announcements/${id}`)).json()).item.status).toBe('published');
  await page.screenshot({ path: resolve(output, 'notice-and-report.png'), fullPage: true, animations: 'disabled' });
  const employee = await staff.newPage();
  employee.on('pageerror', e => errors.push(e.message));
  await employee.goto(url + '/announcements');
  await expect(employee.getByRole('button', { name: 'New announcement' })).toHaveCount(0);
  await expect(employee.getByRole('button', { name: 'Sent', exact: true })).toHaveCount(0);
  await employee.getByRole('link', { name: 'Coordination meeting across all branches', exact: true }).click();
  await expect(employee.getByText('<script>window.announcementInjected=true</script>', { exact: false })).toBeVisible();
  assert.equal(await employee.evaluate(() => window.announcementInjected), undefined);
  await employee.getByRole('button', { name: 'Acknowledge notice' }).click();
  await expect(employee.getByText(/^Acknowledged /)).toBeVisible();
  await employee.setViewportSize({ width: 390, height: 844 });
  await employee.screenshot({ path: resolve(output, 'staff-mobile.png'), fullPage: true, animations: 'disabled' });
  assert(await employee.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal overflow on staff mobile view.');
  await expect.poll(async () => {
    const report = await (await admin.request.get(url + `/api/announcements/${id}/report`)).json();
    return Boolean(report.recipients.find(r => r.user === f.cast.engineer.user)?.acknowledgedAt);
  }).toBe(true);
  await employee.getByRole('link', { name: 'Back to announcements' }).click();
  await staff.setOffline(true);
  await expect(employee.getByRole('heading', { name: 'No internet connection' })).toBeVisible();
  const audience = await (await admin.request.post(url + '/api/announcements/preview', { data: {} })).json();
  const created = await admin.request.post(url + '/api/announcements', { data: { title: 'Notice sent while you were offline', body: 'Saved notice for reconnect.', requireAcknowledgment: false, requestId: randomUUID(), audienceToken: audience.audienceToken } });
  assert([200, 202].includes(created.status()));
  await staff.setOffline(false);
  await expect(employee.getByRole('heading', { name: 'No internet connection' })).toHaveCount(0);
  await expect(employee.getByRole('link', { name: 'Notice sent while you were offline', exact: true })).toBeVisible({ timeout: 20000 });
  await employee.screenshot({ path: resolve(output, 'reconnected-inbox.png'), fullPage: true, animations: 'disabled' });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'browser-result.json'), JSON.stringify({ passed: true, checks: ['Admin compose and preview', 'Send and publication', 'Recipient-only interface', 'Open and acknowledgment', 'Sender report', 'Plain-text script safety', 'Mobile layout', 'Offline gate', 'Reconnect catch-up'], pageErrors: errors }, null, 2));
  console.log('PASS: 9 browser workflow checks, including mobile and reconnect recovery.');
} finally {
  await browser?.close(); await vite.close(); await f.stop();
}
