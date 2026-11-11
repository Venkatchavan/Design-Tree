import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut } from '../helpers/auth-ui';

/**
 * §3 DESIGN MANAGEMENT HEAD — RECEIVES & REVIEWS.
 * Scorecard #4: DMH workspace (My team) renders SPOC roster and KPIs, no errors.
 */
test.describe.serial('03 design head review', () => {
  test('S3.1-S3.2 open My team and verify SPOC roster', async ({ page }) => {
    const dmh = byKey('dmh');
    await signIn(page, dmh.email, TEST_PASSWORD);

    // The Design Management Head workspace is now "My team" (the old
    // Design Management page redirects there): SPOC roster + project KPIs.
    await page.locator('nav.nav').getByRole('button', { name: /^my team$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'My Team' })).toBeVisible();
    await expect(page.getByText('SPOCs', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Assigned projects').first()).toBeVisible();
    await expect(page.getByText('Without a SPOC').first()).toBeVisible();
    // The cast SPOC reports here and no page-level error is shown.
    await expect(page.getByText(/Ananya Rao/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('This page hit a problem')).toHaveCount(0);

    await signOut(page);
  });
});
