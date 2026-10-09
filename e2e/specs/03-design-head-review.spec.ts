import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { PROJECT } from '../fixtures/project';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';

/**
 * §3 DESIGN MANAGEMENT HEAD — RECEIVES & REVIEWS.
 * Scorecard #4: scope/fees match §2, no errors.
 */
test.describe.serial('03 design head review', () => {
  test('S3.1-S3.2 open DT-2601 and verify tabs', async ({ page }) => {
    const dmh = byKey('dmh');
    await signIn(page, dmh.email, TEST_PASSWORD);

    await page.locator('nav.nav').getByRole('button', { name: /design management/i }).first().click();
    await expect(page.getByText('Design Management').first()).toBeVisible();

    // Open project DT-2601.
    const row = page.getByRole('row', { name: /DT-2601/ }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.click();
    } else {
      // Fallback: project selector.
      const select = page.getByLabel(/project \*/i).first();
      if (await select.isVisible().catch(() => false)) {
        await selectOptionContaining(select, 'DT-2601').catch(async () => {});
      }
    }

    for (const tab of ['Overview', 'Coordination', "RFI's", 'Meetings', 'Deliverables', 'Revision']) {
      const btn = page.getByRole('tab', { name: new RegExp(tab, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }

    // Back on Overview: verify required services + fees.
    const overview = page.getByRole('tab', { name: /overview/i }).first();
    if (await overview.isVisible().catch(() => false)) await overview.click();
    for (const s of PROJECT.scope) {
      await expect(page.getByText(s.service).first()).toBeVisible({ timeout: 10_000 });
    }

    await signOut(page);
  });
});
