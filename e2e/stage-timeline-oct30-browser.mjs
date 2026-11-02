// Real forms against disposable API/Mongo. No company data or remote requests.
import { startLocalFixture } from './local-fixture.mjs';
import { createServer } from '../web/node_modules/vite/dist/node/index.js';
import { chromium, expect } from '@playwright/test';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const f = await startLocalFixture();
let vite, browser;
try {
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
  vite = await createServer({
    root: resolve('web'),
    configFile: resolve('web/vite.config.js'),
    server: {
      host: '127.0.0.1',
      port: 5182,
      strictPort: true,
      proxy: {
        '/api': f.base,
        '/socket.io': {
          target: f.base,
          ws: true
        }
      }
    }
  });
  await vite.listen();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    } : {})
  });
  const errors = [];
  const pages = {};
  const base = 'http://127.0.0.1:5182',
    path = `${base}/projects/${f.project}/stage-timeline`;
  for (const key of ['tl', 'spoc', 'td', 'md', 'atd', 'engineer', 'finance']) {
    const context = await browser.newContext();
    const r = await context.request.post(base + '/api/auth/login', {
      data: {
        email: f.cast[key].email,
        password: f.password
      }
    });
    assert(r.ok());
    pages[key] = await context.newPage();
    pages[key].on('pageerror', e => errors.push(e.message));
  }
  const p = pages.tl;
  await p.goto(path);
  const cd = p.locator('tr[data-stage="CD"]');
  await expect(cd).toHaveAttribute('aria-current', 'step');
  await expect(p.locator('.stage-timeline th')).toHaveText(['Service', 'Stage', 'PTL / SPOC / TD', 'Start Date', 'Planned Completion', 'Actual Completion', 'Variance', 'Billing Status', 'Complete Stage']);
  await cd.getByRole('button', {
    name: 'Set dates',
    exact: true
  }).click();
  await p.getByLabel('Start Date', {
    exact: true
  }).fill('2026-08-01');
  await p.getByLabel('Expected Completion Date').fill('2026-08-14');
  await expect(p.getByText('Planned duration: 13 days (1.9 weeks)')).toBeVisible();
  await p.getByRole('button', {
    name: 'Save dates',
    exact: true
  }).click();
  await expect(cd.getByRole('button', {
    name: 'Mark complete',
    exact: true
  })).toBeVisible();
  await cd.getByRole('button', {
    name: 'Edit dates',
    exact: true
  }).click();
  await p.getByLabel('Expected Completion Date').fill('2026-08-17');
  await p.getByLabel('Revision reason').fill('Revised issue sequence');
  await p.getByRole('button', {
    name: 'Save dates',
    exact: true
  }).click();
  await expect(cd.getByText('Original baseline 2026-08-14:', {
    exact: false
  })).toBeVisible();
  await cd.getByRole('button', {
    name: 'Mark complete',
    exact: true
  }).click();
  await p.getByLabel('Actual Completion Date').fill('2026-08-18');
  await expect(p.getByText('Variance: +1 d late', {
    exact: true
  })).toBeVisible();
  await p.getByRole('button', {
    name: 'Submit completion',
    exact: true
  }).click();
  await expect(cd.getByText('PTL Completed')).toBeVisible();
  await p.reload();
  await expect(p.locator('tr[data-stage="CD"] td').nth(5)).toContainText('2026-08-18');
  await pages.spoc.goto(path);
  await pages.spoc.locator('tr[data-stage="CD"]').getByRole('button', {
    name: 'SPOC confirm',
    exact: true
  }).click();
  await expect(pages.spoc.locator('tr[data-stage="CD"]').getByText('SPOC Confirmed', {
    exact: false
  })).toBeVisible();
  await pages.td.goto(path);
  await pages.td.locator('tr[data-stage="CD"]').getByRole('button', {
    name: 'TD approve',
    exact: true
  }).click();
  await expect(pages.td.getByRole('dialog', {
    name: 'CD completed — Plan the SD stage'
  })).toBeVisible();
  await expect(pages.td.getByLabel('Start Date', {
    exact: true
  })).toHaveValue('2026-08-19');
  await pages.td.getByRole('button', {
    name: 'Remind me later',
    exact: true
  }).click();
  const sd = pages.td.locator('tr[data-stage="SD"]');
  await expect(sd.getByRole('button', {
    name: 'Set dates',
    exact: true
  })).toBeVisible();
  await pages.td.reload();
  await expect(pages.td.locator('tr[data-stage="SD"]').getByRole('button', {
    name: 'Set dates',
    exact: true
  })).toBeVisible();
  await pages.atd.goto(path);
  await pages.atd.locator('tr[data-stage="SD"]').getByRole('button', {
    name: 'Set dates',
    exact: true
  }).click();
  await pages.atd.getByLabel('Expected Completion Date').fill('2026-09-01');
  await pages.atd.getByRole('button', {
    name: 'Save dates',
    exact: true
  }).click();
  await expect(pages.atd.locator('tr[data-stage="SD"] td').nth(4)).toContainText('2026-09-01');
  await pages.md.goto(path);
  await expect(pages.md.locator('.stage-timeline')).toBeVisible();
  await expect(pages.md.locator('.stage-timeline button')).toHaveCount(0);
  await pages.md.reload();
  await expect(pages.md.locator('tr[data-stage="CD"]').getByText('Ready for billing')).toBeVisible();
  for (const role of ['engineer', 'finance']) {
    await pages[role].goto(path);
    await expect(pages[role].locator('.stage-timeline')).toBeVisible();
    await expect(pages[role].locator('.stage-timeline button')).toHaveCount(0);
    await pages[role].reload();
    await expect(pages[role].locator('.stage-timeline')).toBeVisible();
  }
  // Exercise the bell's real click-through, including a reader without Projects nav.
  await pages.tl.goto(base+'/dashboard');
  await pages.tl.getByRole('button',{name:'Notifications',exact:true}).click();
  await pages.tl.locator('.notif-item').filter({hasText:'TD approved completion'}).first().click();
  await expect(pages.tl).toHaveURL(path);
  await expect(pages.tl.locator('.stage-timeline')).toBeVisible();
  await pages.tl.screenshot({path:'/tmp/stage-timeline-desktop.png',fullPage:true});
  // Existing future-stage plans must appear in the approval popup, preserving
  // the baseline and requiring an explicit revision reason.
  const legacy=await f.models.Project.create({code:'STAGE-LEGACY-NEXT',name:'Legacy saved next-stage plan',services:['STR']});
  await f.models.Team.create({name:'Legacy timeline team',service:'STR',projects:[legacy._id],lead:f.cast.tl.employee});
  await ServiceDashboard.create({project:legacy._id,service:'STR',technicalDirector:'TEST-td'});
  await f.models.StageStatus.create({project:legacy._id,service:'STR',stage:'CD',startDate:'2026-08-01',plannedCompletion:'2026-08-14',actualCompletion:'2026-08-18',confirmationStatus:'SPOC Confirmed'});
  const savedNext=await f.models.StageStatus.create({project:legacy._id,service:'STR',stage:'SD',startDate:'2026-08-19',plannedCompletion:'2026-09-01',baselineStartDate:'2026-08-19',baselineCompletion:'2026-08-30'});
  await pages.td.goto(`${base}/projects/${legacy._id}/stage-timeline`);
  await pages.td.locator('tr[data-stage="CD"]').getByRole('button',{name:'TD approve',exact:true}).click();
  await expect(pages.td.getByLabel('Expected Completion Date')).toHaveValue('2026-09-01');
  await expect(pages.td.getByText('Locked original baseline: 2026-08-30')).toBeVisible();
  await expect(pages.td.getByLabel('Revision reason')).toHaveAttribute('required','');
  await pages.td.screenshot({path:'/tmp/stage-timeline-saved-popup.png',fullPage:true});
  await pages.td.getByLabel('Expected Completion Date').fill('2026-09-02');
  await pages.td.getByLabel('Revision reason').fill('Retained legacy plan revised with approval');
  await pages.td.getByRole('button',{name:'Save dates',exact:true}).click();
  await expect(pages.td.getByRole('dialog')).toHaveCount(0);
  const persisted=await f.models.StageStatus.findById(savedNext._id).lean();
  assert.equal(persisted.baselineCompletion.toISOString().slice(0,10),'2026-08-30');
  assert.equal(persisted.planRevisions[0].reason,'Retained legacy plan revised with approval');
  await pages.tl.setViewportSize({
    width: 390,
    height: 844
  });
  await pages.tl.reload();
  await expect(pages.tl.locator('.stage-timeline')).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: PTL plan/revise/actual preview and submit; SPOC; scoped TD next popup + remind/refresh; ATD plan; observer/finance/engineer read-only; bell click-through; legacy next baseline/reasoned revision; nine columns and narrow viewport; no browser exceptions.');
} finally {
  await browser?.close();
  await vite?.close();
  await f.stop();
}
