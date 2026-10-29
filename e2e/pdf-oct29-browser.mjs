import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const f = JSON.parse(await readFile('/tmp/designtree-stakeholder-fixture.json', 'utf8'));
assert(f.isolated);
const base = 'http://127.0.0.1:5173';
const out = resolve(import.meta.dirname, '../../client-pdf-review-2026-10-29/evidence');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const checks = [], errors = [];
async function session(role) {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
  assert((await c.request.post(base + '/api/auth/login', { data: { email: f.cast[role].email, password: f.password } })).ok());
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  return { c, p };
}
function done(name) { checks.push({ name, passed: true }); }
try {
  const { c, p } = await session('atd');
  await p.goto(base + '/my-team');
  for (const tab of ['Overview', 'Project & team', 'Team work monitoring', 'Assign work', 'Deliverables', 'Awaiting response', 'Revision', 'Drawing register']) {
    await expect(p.getByRole('tab', { name: tab, exact: true })).toBeVisible();
  }
  done('ATD My Team has the requested working tabs without a nested duplicate My Team tab');
  await expect(p.getByRole('tab', { name: 'My Team', exact: true })).toHaveCount(0);
  await expect(p.getByRole('complementary').getByRole('button', { name: 'Teams', exact: true })).toHaveCount(0);
  await p.getByRole('tab', { name: 'Project & team', exact: true }).click();
  await expect(p.getByRole('cell', { name: 'Test engineer Workflow', exact: true }).first()).toBeVisible();
  await expect(p.getByRole('cell', { name: 'Test outsider Workflow', exact: true })).toHaveCount(0);
  done('ATD project team retains authorized members and excludes other services');
  await p.getByRole('tab', { name: 'Assign work', exact: true }).click();
  await p.getByRole('tab', { name: 'Assign Task', exact: true }).click();
  await expect(p.getByRole('checkbox', { name: 'Test engineer Workflow', exact: false })).toBeVisible();
  await p.screenshot({ path: resolve(out, 'atd-my-team.png'), fullPage: true });
  done('ATD can open the existing task assignment workflow');
  await p.goto(base + '/teams');
  await expect(p).toHaveURL(base + '/my-team');
  done('ATD legacy Teams URL resolves to the single My Team workspace');
  await p.setViewportSize({ width: 390, height: 844 });
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  done('ATD workspace fits a mobile viewport');
  await c.close();

  const tl = await session('tl');
  await tl.p.goto(base + '/my-team');
  await tl.p.getByRole('tab', { name: 'Assign work', exact: true }).click();
  await tl.p.getByRole('tab', { name: 'Assign Task', exact: true }).click();
  await expect(tl.p.getByRole('checkbox', { name: 'Test engineer Workflow', exact: false })).toBeVisible();
  await expect(tl.p.getByRole('checkbox', { name: 'Test outsider Workflow', exact: false })).toHaveCount(0);
  await expect(tl.p.getByRole('checkbox', { name: 'Test peer Workflow', exact: false })).toHaveCount(0);
  await tl.p.screenshot({ path: resolve(out, 'tl-structural-roster.png'), fullPage: true });
  done('Structural TL picker excludes Electrical and Peer Review recipients on the shared project');
  await tl.c.close();

  for (const role of ['td', 'associate', 'hr']) {
    const s = await session(role);
    await s.p.goto(base + (role === 'td' ? '/my-team' : '/teams'));
    await expect(s.p.locator('#director-service')).toBeVisible();
    if (role === 'td') { await s.p.goto(base + '/teams'); await expect(s.p).toHaveURL(base + '/my-team'); }
    done(role + ' retains the intended directory and navigation scope');
    await s.c.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'browser-tests.json'), JSON.stringify({ passed: true, checks, page_errors: errors, scope: 'Production frontend and disposable local API/MongoDB. Company deployment not tested.' }, null, 2) + '\n');
  console.log('All ' + checks.length + ' October 29 browser checks passed.');
} finally { await browser.close(); }
