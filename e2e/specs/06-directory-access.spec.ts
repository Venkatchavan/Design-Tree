import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut } from '../helpers/auth-ui';
import { apiUrl, apiLogin, apiLogout } from '../helpers/api';

/**
 * §6 SPOC — DIRECTORY & ACCESS CHECK.
 * Scorecard #7: portal shows only DT-2601 for client/architect.
 */
test.describe.serial('06 directory access', () => {
  test('S6.0 admin grants DT-2601 portal access to client + architect', async ({ request }) => {
    const admin = byKey('admin');
    await apiLogin(request, admin.email, TEST_PASSWORD);
    const found = await request.get(`${apiUrl()}/api/projects?search=${encodeURIComponent('DT-2601')}`);
    expect(found.ok()).toBeTruthy();
    const items: Array<{ _id: string; code: string }> = (await found.json()).items ?? [];
    const project = items.find((p) => p.code === 'DT-2601');
    expect(project, 'DT-2601 exists').toBeTruthy();
    const users = await request.get(`${apiUrl()}/api/users?search=${encodeURIComponent('designtree.test')}`);
    expect(users.ok(), `users list failed: ${await users.text()}`).toBeTruthy();
    const logins: Array<{ _id: string; email: string; role: string }> =
      (await users.json()).items ?? (await users.json()).users ?? [];
    const ids = logins.filter((u) => u.role === 'client' || u.role === 'architect').map((u) => u._id);
    expect(ids.length, 'client + architect logins').toEqual(2);
    const grant = await request.patch(`${apiUrl()}/api/projects/${project!._id}/portal-users`, {
      data: { userIds: ids },
    });
    expect(grant.ok(), `portal grant failed: ${await grant.text()}`).toBeTruthy();
    await apiLogout(request);
  });

  test('S6.1 SPOC allocation pill + project name', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    await expect(page.getByText('My Coordination').first()).toBeVisible();
    await expect(page.getByText(/1 allocated project\(s\)/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Sunrise Heights Tower A/).first()).toBeVisible();
    await signOut(page);
  });

  test('S6.2 client portal isolation', async ({ page }) => {
    const client = byKey('client');
    await signIn(page, client.email, TEST_PASSWORD);
    // Sidebar shows ONLY Project Portal.
    await expect(page.locator('nav.nav').getByRole('button', { name: /project portal/i })).toBeVisible();
    await expect(page.locator('nav.nav').getByRole('button')).toHaveCount(1);
    await expect(page.getByText(/Sunrise Heights Tower A|DT-2601/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });

  test('S6.2 architect portal isolation', async ({ page }) => {
    const arch = byKey('arch');
    await signIn(page, arch.email, TEST_PASSWORD);
    await expect(page.locator('nav.nav').getByRole('button', { name: /project portal/i })).toBeVisible();
    await expect(page.locator('nav.nav').getByRole('button')).toHaveCount(1);
    await expect(page.getByText(/Sunrise Heights Tower A|DT-2601/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});
