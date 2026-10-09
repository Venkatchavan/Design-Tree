import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { SPOC_SERVICES } from '../fixtures/project';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';

/**
 * §5 SPOC ALLOCATION → PROJECT ACTIVATION.
 * Scorecard #6: Overview "1 allocated project(s)".
 */
test.describe.serial('05 spoc allocation', () => {
  test('S5.1-S5.2 record allocation for DT-2601', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);

    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    await expect(page.getByText('My Coordination').first()).toBeVisible();

    const dirTab = page.getByRole('tab', { name: /project directory/i }).first();
    if (await dirTab.isVisible().catch(() => false)) await dirTab.click();
    await expect(page.getByText('Record allocation').first()).toBeVisible();

    // Project dropdown → DT-2601.
    const projectSelect = page.getByLabel(/project/i).first();
    if (await projectSelect.isVisible().catch(() => false)) {
      await selectOptionContaining(projectSelect, 'DT-2601').catch(async () => {});
    }
    // Coordinator dropdown → Ananya Rao.
    const coordSelect = page.getByLabel(/coordinator/i).first();
    if (await coordSelect.isVisible().catch(() => false)) {
      await selectOptionContaining(coordSelect, 'Ananya Rao').catch(async () => {});
    }
    // Services checkboxes.
    for (const s of SPOC_SERVICES) {
      const box = page.getByRole('checkbox', { name: new RegExp(s, 'i') }).first();
      if (await box.isVisible().catch(() => false)) {
        if (!(await box.isChecked().catch(() => true))) await box.check();
      }
    }

    await page.getByRole('button', { name: /record allocation/i }).click();

    // Expected: Overview tab → "1 allocated project(s)".
    const overview = page.getByRole('tab', { name: /overview/i }).first();
    if (await overview.isVisible().catch(() => false)) await overview.click();
    await expect(page.getByText(/1 allocated project\(s\)/i).first()).toBeVisible({ timeout: 20_000 });

    await signOut(page);
  });
});
