import { test, expect } from '@playwright/test';
import { CAST, SUPERUSER, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut, gotoNav } from '../helpers/auth-ui';

/**
 * §1 CAST CREATION — superuser creates all logins.
 * Internal cast via HR -> Employee management (Add employee);
 * client/architect via HR -> External access (Create external login —
 * externals never get employee records).
 * Scorecard #1 (11 logins; all sign in), #2 (Employee profile modal).
 *
 * Precondition: api seeded with superuser only (npm run seed), empty DB.
 * Superuser password comes from api/.env SEED_PASSWORD — pass via E2E_SU_PASSWORD
 * env or login will fail with a clear message.
 */

const SU_PASSWORD = process.env.E2E_SU_PASSWORD ?? '';

test.describe.serial('01 cast creation', () => {
  test.setTimeout(300_000);
  test('S1.1-S1.4 create 12 logins (10 employees + client/architect externals)', async ({ page }) => {
    test.skip(!SU_PASSWORD, 'Set E2E_SU_PASSWORD to the api SEED_PASSWORD to run §1.');
    await signIn(page, SUPERUSER.email, SU_PASSWORD);

    await gotoNav(page, 'HR');
    await page.getByRole('tab', { name: /employee management/i }).click().catch(async () => {
      await page.getByRole('button', { name: /employee management/i }).click();
    });
    await expect(page.getByRole('button', { name: 'Add employee' })).toBeVisible();

    for (const person of CAST.filter((p) => p.role !== 'client' && p.role !== 'architect')) {
      await page.getByRole('button', { name: 'Add employee' }).click();
      await expect(page.getByText(/Payroll form.*all sections/i)).toBeVisible();

      // Identity section. Labels verified in HRPage.jsx.
      // Designation/Department/Branch render as <select> (choices from
      // existing data); select when the CAST value exists, else skip
      // (optional on create — names + login carry the workflow).
      async function fillOrSelect(re, value) {
        const el = page.getByLabel(re).first();
        if (!(await el.isVisible().catch(() => false))) return;
        const tag = await el.evaluate((n) => n.tagName).catch(() => '');
        if (tag === 'SELECT') {
          // Fast path: only select on exact option-text match, never wait.
          const texts = await el.locator('option').allTextContents().catch(() => []);
          if (texts.some((t) => t.trim() === value)) {
            await el.selectOption({ label: value });
          }
          return;
        }
        await el.fill(value);
      }
      const first = page.getByLabel(/first name/i).first();
      if (await first.isVisible().catch(() => false)) {
        await first.fill(person.firstName);
        await page.getByLabel(/last name/i).first().fill(person.lastName);
        await fillOrSelect(/designation/i, person.designation);
        await fillOrSelect(/department/i, person.department);
        await fillOrSelect(/branch/i, person.branch);
        const doj = page.getByLabel(/date of joining/i).first();
        if (await doj.isVisible().catch(() => false)) await doj.fill(person.dateOfJoining);
      } else {
        // Fallback: positional inputs inside modal.
        const inputs = page.locator('.modal input.form-input, [role="dialog"] input');
        await inputs.nth(1).fill(person.firstName);
        await inputs.nth(2).fill(person.lastName);
      }

      // Login (restricted) section.
      await page.getByLabel(/login email/i).first().fill(person.email);
      await page.getByLabel(/^password/i).first().fill(TEST_PASSWORD);
      const roleSelect = page.getByLabel(/role/i).last();
      if (await roleSelect.isVisible().catch(() => false)) {
        // Option values are role keys (value={r.key}), so select by value.
        await roleSelect.selectOption(person.role);
      }

      await page.getByRole('button', { name: /save employee/i }).click();
      // Modal closes on success.
      await expect(page.getByText(/Payroll form.*all sections/i)).toBeHidden({ timeout: 20_000 });
      await expect(page.getByRole('cell', { name: `${person.firstName} ${person.lastName}` }).first()).toBeVisible();
    }

    // Client + Architect have no employee records — provision portal logins
    // under HR -> External access.
    await page.getByRole('tab', { name: /external access/i }).click().catch(async () => {
      await page.getByRole('button', { name: /external access/i }).click();
    });
    await expect(page.getByText('New external login')).toBeVisible();
    for (const person of CAST.filter((p) => p.role === 'client' || p.role === 'architect')) {
      await page.getByLabel('Role').selectOption(person.role);
      await page.getByLabel('Name *').fill(`${person.firstName} ${person.lastName}`);
      await page.getByLabel('Email *').fill(person.email);
      await page.getByLabel(/Password \* \(min 8 characters\)/i).fill(TEST_PASSWORD);
      await page.getByRole('button', { name: /create external login/i }).click();
      await expect(page.getByRole('cell', { name: person.email }).first()).toBeVisible({ timeout: 20_000 });
    }

    await signOut(page);
  });

  test('S1.4b employee profile modal shows linked login', async ({ page }) => {
    test.skip(!SU_PASSWORD, 'Set E2E_SU_PASSWORD to run §1.');
    await signIn(page, SUPERUSER.email, SU_PASSWORD);
    await gotoNav(page, 'HR');
    await page.getByRole('row', { name: /Vikram Rao/ }).first().click();
    await expect(page.getByText('Employee profile')).toBeVisible();
    await expect(page.getByText('admin@designtree.test')).toBeVisible();
    await page.keyboard.press('Escape');
    await signOut(page);
  });
});
