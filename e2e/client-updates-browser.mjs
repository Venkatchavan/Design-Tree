import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const f = JSON.parse(
  await readFile(
    process.env.TEST_FIXTURE_FILE || '/tmp/designtree-local-fixture.json',
    'utf8',
  ),
);
assert(f.isolated && f.base.startsWith('http://127.0.0.1:'));
const base = process.env.TEST_WEB_URL || 'http://127.0.0.1:5173',
  out = resolve(
    process.env.TEST_REPORT_DIR || '../client-updates-2026-10-23/evidence',
  );
await mkdir(out, { recursive: true });
const webURL = new URL(base);
assert.equal(webURL.hostname, '127.0.0.1', 'Use the isolated loopback web server only.');
const args = [];
if (webURL.protocol === 'https:') {
  assert(process.env.TEST_CERTIFICATE, 'Provide the disposable TLS certificate.');
  const publicKey = execFileSync('openssl', ['x509', '-in', process.env.TEST_CERTIFICATE, '-pubkey', '-noout']);
  const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'DER'], { input: publicKey });
  args.push('--ignore-certificate-errors-spki-list=' + createHash('sha256').update(der).digest('base64'));
}
const browser = await chromium.launch({
  headless: true,
  args,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const errors = [],
  checks = [];
const run = Date.now().toString(36),
  COORD = 'UI overdue coordination ' + run,
  TASK = 'UI task from confirmed roster ' + run,
  DRAW = 'UI-REGISTER-' + run,
  REV = 'UI revision acceptance ' + run;
const panel = (p, title) =>
  p
    .locator('.panel')
    .filter({
      has: p.locator('.panel-title', {
        hasText: new RegExp('^' + title + '$'),
      }),
    });
async function session(role) {
  const c = await browser.newContext({
    ignoreHTTPSErrors: webURL.protocol === 'https:',
    viewport: { width: 1440, height: 1100 },
  });
  const login = await c.request.post(base + '/api/auth/login', {
    data: { email: f.cast[role].email, password: f.password },
  });
  expect(login.ok()).toBeTruthy();
  const page = await c.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { c, page };
}
async function check(name, requirements, fn) {
  await fn();
  checks.push({ name, requirements, passed: true });
  console.log('PASS ' + name);
}
try {
  const { c: admin, page: a } = await session('admin'),
    { c: spoc, page: s } = await session('spoc'),
    { c: tl, page: t } = await session('tl');
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
  expect(
    (
      await spoc.request.put(base + `/api/projects/${f.project}/team-leads`, {
        data: { principalTeamLeads: rows },
      })
    ).ok(),
  ).toBeTruthy();
  async function openAssignedTeam() {
    const response = await tl.request.get(base + '/api/teams/mine');
    expect(response.ok()).toBeTruthy();
    const { items } = await response.json();
    const team = items.find((item) => item.allocationProject === f.project);
    assert(team, 'Confirmed fixture project team must exist.');
    await t.goto(base + '/my-team');
    if (items.length > 1) {
      const id = String(team._id ?? team.id);
      await t.locator('select').filter({ has: t.locator('option[value="' + id + '"]') }).selectOption(id);
    }
  }
  let created;
  await check(
    'Admin creates marked fields and no duplicate PMC/Peer Review inputs',
    ['R-CU01', 'R-CU12'],
    async () => {
      await a.goto(base + '/projects/new');
      await expect(
        a.locator('.page-title').filter({ hasText: 'New Project' }),
      ).toBeVisible();
      await expect(a.getByText('PMC Contact', { exact: true })).toHaveCount(0);
      await expect(
        a.getByText('Peer Review Contact', { exact: true }),
      ).toHaveCount(0);
      await a
        .getByPlaceholder('e.g. Business park - Tower A')
        .fill('Client UI acceptance project');
      await a.getByPlaceholder('Search Entities...').fill('Acceptance entity');
      for (const [key, value] of Object.entries({
        sourcePerson: 'UI source person',
        referral: 'UI referral',
        startDate: '2026-10-01',
        expectedCompletion: '2027-03-01',
        actualCompletion: '2027-02-01',
      }))
        await a.getByLabel(key, { exact: true }).fill(value);
      await a
        .getByRole('button', { name: 'Add Location', exact: true })
        .click();
      await a
        .getByRole('button', { name: 'Custom address', exact: true })
        .click();
      await a
        .getByRole('dialog')
        .getByPlaceholder('e.g. Whitefield, Bengaluru')
        .last()
        .fill('Local acceptance address');
      await a
        .getByRole('button', { name: 'Save Location', exact: true })
        .click();
      await a.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(a).toHaveURL(/\/projects\/[a-f0-9]{24}$/);
      created = a.url().split('/').at(-1);
      await expect(
        a.getByText('UI source person', { exact: true }),
      ).toBeVisible();
      await expect(a.getByText('UI referral', { exact: true })).toBeVisible();
    },
  );
  await check(
    'Project summary Job number, comprehensive editor, saved changes and audit history',
    ['R-CU13', 'R-CU14', 'R-CU15'],
    async () => {
      await expect(
        panel(a, 'Project summary').getByText('Job number', { exact: true }),
      ).toBeVisible();
      await a
        .getByRole('button', { name: 'Edit project details', exact: true })
        .click();
      await a
        .getByLabel('Source person', { exact: true })
        .fill('UI corrected source');
      await a
        .getByRole('button', { name: 'Save project details', exact: true })
        .click();
      await expect(a.getByRole('dialog')).toHaveCount(0);
      await expect(
        a.getByText('UI corrected source', { exact: true }),
      ).toBeVisible();
      await expect(
        panel(a, 'Project update history')
          .getByText('Test admin', { exact: true })
          .first(),
      ).toBeVisible();
      await a.reload();
      await expect(
        a.getByText('UI corrected source', { exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    'SPOC Directory has contact pickers, editable nominations and no duplicate panels',
    ['R-CU01', 'R-CU02', 'R-CU05', 'R-CU06', 'R-CU07', 'R-CU17'],
    async () => {
      await s.goto(base + '/projects/' + f.project);
      await s
        .getByRole('tab', { name: 'Project Directory', exact: true })
        .first()
        .click();
      await expect(panel(s, 'Project contacts & coordination')).toHaveCount(0);
      const alloc = panel(s, 'Team allocation');
      await expect(
        alloc.getByText('Role / responsibility', { exact: true }),
      ).toHaveCount(0);
      await alloc
        .getByRole('button', { name: 'Edit allocation', exact: true })
        .last()
        .click();
      await alloc.locator('select').nth(2).selectOption('Test td Workflow');
      await alloc
        .getByRole('button', { name: 'Save allocation changes', exact: true })
        .click();
      await expect(
        alloc.getByText('Team allocation recorded.', { exact: true }),
      ).toBeVisible();
      const contacts = panel(s, 'PMC and Peer Review contacts');
      while (
        await contacts
          .getByRole('button', { name: 'Change', exact: true })
          .count()
      )
        await contacts
          .getByRole('button', { name: 'Change', exact: true })
          .first()
          .click();
      for (const [type, name] of [
        ['PMC', 'UI PMC'],
        ['Peer Review', 'UI Peer Contact'],
      ]) {
        const result = await spoc.request.post(
          base + '/api/marketing/contacts',
          {
            data: {
              type,
              name,
              organization: 'Acceptance company',
              phone: '100200',
            },
          },
        );
        expect(result.ok()).toBeTruthy();
        const input = contacts.getByPlaceholder('Search Contacts...').nth(0);
        await input.fill(name);
        await contacts
          .locator('.location-result-row')
          .filter({ hasText: name })
          .first()
          .click();
      }
      await contacts
        .getByRole('button', { name: 'Save contacts', exact: true })
        .click();
      await expect(
        contacts.getByText('Contacts saved.', { exact: true }),
      ).toBeVisible();
      await s.reload();
      await expect(
        panel(s, 'Client contact details').getByText('UI PMC', { exact: true }),
      ).toBeVisible();
      await expect(
        panel(s, 'Client contact details').getByText('UI Peer Contact', {
          exact: true,
        }),
      ).toBeVisible();
    },
  );
  await check(
    'SPOC daily-work Documents label and no RFI category',
    ['R-CU04', 'R-CU18'],
    async () => {
      await s.goto(base + '/my-coordination');
      await expect(
        s.getByRole('checkbox', {
          name: 'Select Documents work area',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        s.getByRole('checkbox', { name: 'Select RFI work area', exact: true }),
      ).toHaveCount(0);
    },
  );
  await check(
    'Coordination entry persists and the responsible team sees Overdue',
    ['R-CU03'],
    async () => {
      await s.goto(base + '/projects/' + f.project);
      await s.getByRole('tab', { name: 'Coordination', exact: true }).click();
      await s.getByLabel('Coordination topic').fill(COORD);
      await s.getByLabel('Coordination deadline').fill('2020-01-01');
      await s.getByRole('button', { name: 'Log item', exact: true }).click();
      await expect(
        panel(s, 'Coordination items').getByText(COORD, { exact: true }),
      ).toBeVisible();
      await openAssignedTeam();
      await expect(
        panel(t, 'Coordination items').getByText(COORD, { exact: true }),
      ).toBeVisible();
      await expect(
        panel(t, 'Coordination items')
          .locator('tr')
          .filter({ hasText: COORD })
          .getByText('Overdue', { exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    'PTL sees project-grouped members and ordered Assign Work sections; assigns a task',
    ['R-CU23', 'R-CU24', 'R-CU26', 'R-CU27'],
    async () => {
      await t.getByRole('tab', { name: 'Project & team', exact: true }).click();
      await expect(
        t
          .locator('.panel-title')
          .filter({ hasText: 'Assigned workflow project' }),
      ).toBeVisible();
      await t.getByRole('tab', { name: 'Assign work', exact: true }).click();
      const tabs = t.getByRole('tablist').last();
      expect(await tabs.getByRole('tab').allTextContents()).toEqual([
        'List of Deliverables',
        'Assign Task',
        'Work Assigned by Me',
      ]);
      await expect(
        t.getByRole('tab', { name: 'List of Deliverables', exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      for (const title of [
        'Upload a list of drawings',
        'Enter drawing details',
        'Deliverables log',
      ])
        await expect(panel(t, title)).toHaveCount(0);
      await t.getByRole('tab', { name: 'Assign Task', exact: true }).click();
      const form = panel(t, 'Assign work to a team member');
      await form.getByLabel('Test engineer Workflow', { exact: true }).check();
      await form
        .locator('select')
        .filter({ has: t.locator('option[value="' + f.project + '"]') })
        .selectOption(f.project);
      await form
        .getByPlaceholder('Bore hole location and specifications')
        .fill(TASK);
      const submitted = t.waitForResponse(
        (r) =>
          r.url().endsWith('/api/work/tasks') &&
          r.request().method() === 'POST',
      );
      await form
        .getByRole('button', { name: 'Assign task', exact: true })
        .click();
      const result = await submitted;
      expect(result.status()).toBe(201);
      await t
        .getByRole('tab', { name: 'Work Assigned by Me', exact: true })
        .click();
      await expect(t.getByText(TASK, { exact: true })).toBeVisible();
    },
  );
  await check(
    'Drawing Register has entry, Service/Stage/Rev dropdowns and persisted log',
    ['R-CU25', 'R-CU28'],
    async () => {
      await t
        .getByRole('tab', { name: 'Drawing register', exact: true })
        .click();
      const form = panel(t, 'Enter drawing details');
      const row = form.locator('tbody tr').first();
      await row.locator('input').nth(0).fill(DRAW);
      await row.locator('input').nth(1).fill('UI register drawing');
      await row.locator('select').nth(0).selectOption('STR');
      await row.locator('select').nth(1).selectOption('CD');
      await row.getByLabel('Drawing revision').selectOption('R01');
      await form
        .getByRole('button', { name: 'Add to register', exact: true })
        .click();
      await expect(
        panel(t, 'Structural drawing register').getByText(DRAW, {
          exact: true,
        }),
      ).toBeVisible();
    },
  );
  await check(
    'My Team Revision entry and log work; project detail has no duplicate workspace',
    ['R-CU30', 'R-CU31'],
    async () => {
      await t.getByRole('tab', { name: 'Revision', exact: true }).click();
      await t.getByRole('tab', { name: 'Revision entry', exact: true }).click();
      const form = panel(t, 'Revision entry');
      await form.locator('select').first().selectOption(f.project);
      await form
        .getByLabel('Revision assigned to')
        .selectOption(f.cast.engineer.employee);
      await form.locator('textarea').fill(REV);
      await form
        .getByRole('button', { name: 'Log revision', exact: true })
        .click();
      await t.getByRole('tab', { name: 'Revision log', exact: true }).click();
      await expect(
        panel(t, 'Revision log').getByText(REV, { exact: true }),
      ).toBeVisible();
      await t.goto(base + '/projects/' + f.project);
      await expect(
        t.getByText('Project team workspace', { exact: true }),
      ).toHaveCount(0);
      await expect(
        t.getByRole('tab', { name: 'Team workspace', exact: true }),
      ).toHaveCount(0);
    },
  );
  await check(
    'Only PTL progress entry hides assigned-daily-work selector',
    ['R-CU29'],
    async () => {
      await t.goto(base + '/work/update');
      await expect(
        t.getByText('Assigned Daily Work from PTL/TL', { exact: true }),
      ).toHaveCount(0);
      const { page: e } = await session('engineer');
      await e.goto(base + '/my-work');
      await e
        .getByRole('tab', { name: 'Update progress', exact: true })
        .click();
      await expect(
        e.getByText('Assigned Daily Work from PTL/TL', { exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    'Admin transmittal log remains without Add transmittal',
    ['R-CU16'],
    async () => {
      await a.goto(base + '/admin/transmittals');
      await expect(
        a.getByRole('button', { name: 'Add transmittal', exact: true }),
      ).toHaveCount(0);
      await expect(panel(a, 'Transmittal log')).toBeVisible();
    },
  );
  await check(
    'Director Finance and Billing have no edit actions; Finance retains authorized creation',
    ['R-CU19', 'R-CU20', 'R-CU21'],
    async () => {
      for (const role of ['md', 'wd', 'ed']) {
        const { page: d } = await session(role);
        await d.goto(base + '/finance/hub');
        await expect(
          d.getByText('Finance Operations Control Centre', { exact: true }),
        ).toBeVisible();
        await expect(
          d.getByRole('button', { name: '+ Purchase order', exact: true }),
        ).toHaveCount(0);
        await d.goto(base + '/billing');
        await d
          .getByRole('tab', {
            name: 'Stage tracker & billing readiness',
            exact: true,
          })
          .click();
        await expect(
          d.getByRole('button', { name: 'Mark billed', exact: true }),
        ).toHaveCount(0);
        await d
          .getByRole('tab', { name: 'Project quoted fee', exact: true })
          .click();
        await expect(
          d.getByRole('button', { name: 'Edit', exact: true }),
        ).toHaveCount(0);
      }
      const { page: fin } = await session('finance');
      await fin.goto(base + '/finance/hub');
      await expect(
        fin.getByRole('button', { name: '+ Purchase order', exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    'Marketing excludes Admin projects and retains Marketing-owned portfolio',
    ['R-CU22'],
    async () => {
      const { page: m } = await session('marketing');
      await m.goto(base + '/marketing');
      await expect(
        m.getByText('Marketing-owned portfolio', { exact: true }),
      ).toBeVisible();
      await expect(
        m.getByText('Client UI acceptance project', { exact: true }),
      ).toHaveCount(0);
    },
  );
  await check(
    'Peer Review dashboard and single dashboard Work Tracking path retain all tools',
    ['R-CU08', 'R-CU09', 'R-CU10'],
    async () => {
      for (const role of ['peer', 'peerhead']) {
        const { page: p } = await session(role);
        await p.goto(base + '/');
        await expect(p).toHaveURL(/peer-review\/dashboard$/);
        await expect(
          p.getByText('Assigned workflow project', { exact: true }),
        ).toBeVisible();
        await expect(
          p.getByRole('link', { name: 'Work Tracking', exact: true }),
        ).toHaveCount(1);
        await p
          .getByRole('link', { name: 'Work Tracking', exact: true })
          .click();
        await expect(
          p.getByRole('tab', { name: 'Log work', exact: true }),
        ).toBeVisible();
        await expect(
          p.getByRole('tab', { name: 'Revisions', exact: true }),
        ).toBeVisible();
        await expect(
          p.getByRole('tab', { name: 'Peer Review', exact: true }),
        ).toBeVisible();
      }
    },
  );
  assert.deepEqual(errors, []);
  const covered = [...new Set(checks.flatMap((c) => c.requirements))].sort();
  assert.equal(covered.length, 30);
  await openAssignedTeam();
  await t.getByRole('tab', { name: 'Revision', exact: true }).click();
  await t.screenshot({
    path: resolve(out, 'ptl-implementation.png'),
    fullPage: true,
  });
  await s.goto(base + '/projects/' + f.project);
  await s
    .getByRole('tab', { name: 'Project Directory', exact: true })
    .first()
    .click();
  await s.screenshot({
    path: resolve(out, 'spoc-implementation.png'),
    fullPage: true,
  });
  await writeFile(
    resolve(out, 'client-browser-tests.json'),
    JSON.stringify(
      {
        passed: true,
        checks,
        covered,
        held: ['R-CU11'],
        page_errors: errors,
        production_checked: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'All ' +
      checks.length +
      ' browser checks passed, covering 30 confirmed client requirements. Announcements held.',
  );
} catch (error) {
  await writeFile(
    resolve(out, 'client-browser-failure.json'),
    JSON.stringify(
      { passed: false, error: error.message, checks, page_errors: errors },
      null,
      2,
    ) + '\n',
  );
  throw error;
} finally {
  await browser.close();
}
