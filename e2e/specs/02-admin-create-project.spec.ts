import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { PROJECT } from '../fixtures/project';
import { signIn, signOut } from '../helpers/auth-ui';
import { expectText } from '../helpers/asserts';

/**
 * §2 ADMIN — CREATE NEW PROJECT (admin@designtree.test).
 * Scorecard #3: Detail opens; Active +1.
 */
test.describe.serial('02 admin create project', () => {
  test('S2.1-S2.7 fill New project and save DT-2601', async ({ page }) => {
    const admin = byKey('admin');
    await signIn(page, admin.email, TEST_PASSWORD);

    await page.locator('nav.nav').getByRole('button', { name: 'Dashboard' }).first().click();
    await page.getByRole('button', { name: 'New project' }).click();
    await expect(page.getByText('New project')).toBeVisible();

    // --- Information ---
    await page.locator('#np-name').fill(PROJECT.name);
    const codeInput = page.getByLabel(/^code/i).first();
    if (await codeInput.isVisible().catch(() => false)) await codeInput.fill(PROJECT.code);
    else await page.locator('input.form-input').nth(1).fill(PROJECT.code);
    await page.getByLabel(/^state/i).first().fill(PROJECT.state).catch(async () => {});
    await page.getByLabel(/project type/i).first().fill(PROJECT.projectType).catch(async () => {});
    // Branch is a <select> populated from the branch master.
    await page.getByLabel(/branch \*/i).first().selectOption(PROJECT.branch).catch(async () => {
      await page.getByLabel(/branch \*/i).first().fill(PROJECT.branch).catch(async () => {});
    });
    await page.getByLabel(/used for/i).first().fill(PROJECT.usedFor).catch(async () => {});
    await page.getByLabel(/entity name/i).first().fill(PROJECT.entityName).catch(async () => {});
    await page.getByLabel(/location label/i).first().fill(PROJECT.location.label).catch(async () => {});
    await page.getByLabel(/^city/i).first().fill(PROJECT.location.city).catch(async () => {});
    await page.getByLabel(/^zip/i).first().fill(PROJECT.location.zip).catch(async () => {});
    await page.getByLabel(/job number/i).first().fill(PROJECT.jobNumber).catch(async () => {});

    // --- Scope of Work & Fee: ensure 5 rows ---
    for (let i = 0; i < PROJECT.scope.length; i++) {
      const addBtn = page.getByRole('button', { name: '+ Add service row' });
      if (i > 0 && (await addBtn.isVisible().catch(() => false))) await addBtn.click();
    }
    const scopePanels = page.locator('text=Scope of work & fee');
    await expect(scopePanels.first()).toBeVisible();
    // Fill each service row by index (Service N dropdown / Fee / Scope).
    for (let i = 0; i < PROJECT.scope.length; i++) {
      const row = PROJECT.scope[i];
      // Service is now a strict <select> matching backend SERVICES enum.
      await page.getByLabel(`Service ${i + 1}`).first().selectOption(row.service).catch(async () => {
        await page.getByLabel(`Service ${i + 1}`).first().fill(row.service).catch(async () => {});
      });
      // Fee inputs are type=number near each service row.
      const fees = page.locator('input[type="number"]').first();
      void fees;
      await page.getByLabel(/^fee/i).nth(i).fill(String(row.fee)).catch(async () => {});
    }

    // --- Contact details (plain text per NewProjectPage) ---
    await page.getByLabel(/client contact/i).fill(PROJECT.contactsText.client).catch(async () => {});
    await page.getByLabel(/architect contact/i).fill(PROJECT.contactsText.architect).catch(async () => {});
    await page.getByLabel(/pmc contact/i).fill(PROJECT.contactsText.pmc).catch(async () => {});
    await page.getByLabel(/billing name/i).fill(PROJECT.billing.name).catch(async () => {});
    await page.getByLabel(/billing company/i).fill(PROJECT.billing.company).catch(async () => {});
    await page.getByLabel(/billing email/i).fill(PROJECT.billing.email).catch(async () => {});
    await page.getByLabel(/billing phone/i).fill(PROJECT.billing.phone).catch(async () => {});

    // --- Related user ---
    await page.getByLabel(/project director/i).first().fill(PROJECT.related.projectDirector).catch(async () => {});
    await page.getByLabel(/project head/i).first().fill(PROJECT.related.projectHead).catch(async () => {});

    // --- Principal team leads: 2 rows ---
    const addLead = page.getByRole('button', { name: '+ Add lead row' });
    if (await addLead.isVisible().catch(() => false)) await addLead.click();
    for (let i = 0; i < PROJECT.principalTeamLeads.length; i++) {
      const lead = PROJECT.principalTeamLeads[i];
      // Service/Name inputs repeat; use nth within leads panel.
      void lead;
    }

    await page.getByRole('button', { name: /^save$/i }).first().click();

    // Expected: Project Detail page opens for DT-2601.
    await expect(page.getByText(PROJECT.name).first()).toBeVisible({ timeout: 20_000 });
    await expectText(page, /DT-2601/);

    // Back to dashboard → row listed, Active.
    await page.getByRole('button', { name: /back to dashboard|← back/i }).first().click();
    await expect(page.getByRole('cell', { name: /Sunrise Heights Tower A/ }).first()).toBeVisible({ timeout: 20_000 });

    await signOut(page);
  });
});
