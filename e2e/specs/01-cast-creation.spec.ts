import { test, expect } from '@playwright/test';
import { CAST, FD, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut, gotoNav } from '../helpers/auth-ui';

/**
 * §1 CAST CREATION — FD creates all logins (HR -> Employee management).
 * Scorecard #1 (11 rows; all sign in), #2 (Employee profile modal).
 *
 * Precondition: api seeded with FD only (npm run seed), empty DB.
 * FD password comes from api/.env SEED_PASSWORD — pass via E2E_FD_PASSWORD
 * env or login will fail with a clear message.
 */

const FD_PASSWORD = process.env.E2E_FD_PASSWORD ?? '';

test.describe.serial('01 cast creation', () => {
  test('S1.1-S1.4 create 11 employees via Add employee', async ({ page }) => {
    test.skip(!FD_PASSWORD, 'Set E2E_FD_PASSWORD to the api SEED_PASSWORD to run §1.');
    await signIn(page, FD.email, FD_PASSWORD);

    await gotoNav(page, 'HR');
    await page.getByRole('tab', { name: /employee management/i }).click().catch(async () => {
      await page.getByRole('button', { name: /employee management/i }).click();
    });
    await expect(page.getByRole('button', { name: 'Add employee' })).toBeVisible();

    for (const person of CAST) {
      await page.getByRole('button', { name: 'Add employee' }).click();
      await expect(page.getByText('Payroll form - all sections')).toBeVisible();

      // Identity section. Labels verified in HRPage.jsx.
      const first = page.getByLabel(/first name/i).first();
      if (await first.isVisible().catch(() => false)) {
        await first.fill(person.firstName);
        await page.getByLabel(/last name/i).first().fill(person.lastName);
        const desig = page.getByLabel(/designation/i).first();
        if (await desig.isVisible().catch(() => false)) await desig.fill(person.designation);
        const dept = page.getByLabel(/department/i).first();
        if (await dept.isVisible().catch(() => false)) await dept.fill(person.department);
        const branch = page.getByLabel(/branch/i).first();
        if (await branch.isVisible().catch(() => false)) await branch.fill(person.branch);
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
        await roleSelect.selectOption({ label: person.role }).catch(async () => {
          await roleSelect.selectOption(person.role);
        });
      }

      await page.getByRole('button', { name: /save employee/i }).click();
      // Modal closes on success.
      await expect(page.getByText('Payroll form - all sections')).toBeHidden({ timeout: 20_000 });
      await expect(page.getByRole('cell', { name: `${person.firstName} ${person.lastName}` }).first()).toBeVisible();
    }

    await signOut(page);
  });

  test('S1.4b employee profile modal shows linked login', async ({ page }) => {
    test.skip(!FD_PASSWORD, 'Set E2E_FD_PASSWORD to run §1.');
    await signIn(page, FD.email, FD_PASSWORD);
    await gotoNav(page, 'HR');
    await page.getByRole('row', { name: /Vikram Rao/ }).first().click();
    await expect(page.getByText('Employee profile')).toBeVisible();
    await expect(page.getByText('admin@designtree.test')).toBeVisible();
    await page.keyboard.press('Escape');
    await signOut(page);
  });
});
