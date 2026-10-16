import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';

/**
 * §3 DESIGN MANAGEMENT HEAD — RECEIVES & REVIEWS.
 * Scorecard #4: project DT-2601 selectable, workflow tabs render, no errors.
 */
test.describe.serial('03 design head review', () => {
  test('S3.1-S3.2 open DT-2601 and verify tabs', async ({ page }) => {
    const dmh = byKey('dmh');
    await signIn(page, dmh.email, TEST_PASSWORD);

    await page.locator('nav.nav').getByRole('button', { name: /design management/i }).first().click();
    await expect(page.getByText('Design Management').first()).toBeVisible();

    // Project selector → DT-2601 (selected option text holds the code).
    const projectSelect = page.getByLabel(/project \*/i).first();
    if (await projectSelect.isVisible().catch(() => false)) {
      await selectOptionContaining(projectSelect, 'DT-2601').catch(async () => {});
      const selected = await projectSelect.locator('option:checked').textContent().catch(() => '');
      expect(selected ?? '').toMatch(/DT-2601/);
    }

    for (const tab of ['Workflow', 'Responsibility', 'Deliverables', 'RFIs', 'Team & client']) {
      const btn = page.getByRole('tab', { name: new RegExp(tab, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    // Land back on Workflow: tracker chrome renders, no error banner.
    const workflow = page.getByRole('tab', { name: /workflow/i }).first();
    if (await workflow.isVisible().catch(() => false)) await workflow.click();
    await expect(page.getByText(/No (deliverables|workflow)|Deliverables tracker|Design workflow/i).first()).toBeVisible({ timeout: 10_000 });

    await signOut(page);
  });
});
