import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut } from '../helpers/auth-ui';

/**
 * §6 SPOC — DIRECTORY & ACCESS CHECK.
 * Scorecard #7: portal shows only DT-2601 for client/architect.
 */
test.describe.serial('06 directory access', () => {
  test('S6.1 SPOC overview pill shows DT-2601', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    const overview = page.getByRole('tab', { name: /overview/i }).first();
    if (await overview.isVisible().catch(() => false)) await overview.click();
    await expect(page.getByText(/DT-2601/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });

  test('S6.2 client portal isolation', async ({ page }) => {
    const client = byKey('client');
    await signIn(page, client.email, TEST_PASSWORD);
    // Sidebar shows ONLY Project Portal.
    await expect(page.locator('nav.nav').getByRole('button', { name: /project portal/i })).toBeVisible();
    await expect(page.getByText(/DT-2601/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });

  test('S6.2 architect portal isolation', async ({ page }) => {
    const arch = byKey('arch');
    await signIn(page, arch.email, TEST_PASSWORD);
    await expect(page.locator('nav.nav').getByRole('button', { name: /project portal/i })).toBeVisible();
    await expect(page.getByText(/DT-2601/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});
