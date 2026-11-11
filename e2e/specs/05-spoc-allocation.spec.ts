import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';
import { apiUrl, apiLogin, apiLogout } from '../helpers/api';

/**
 * §5 SPOC ALLOCATION → PROJECT ACTIVATION.
 * Current flow: Technical Director picks the SPOC on Project Detail and
 * clicks "Activate project" (UI); the allocation is created Approved
 * → SPOC sees the allocation (UI).
 * Scorecard #6: Overview "1 allocated project(s)".
 */
test.describe.serial('05 spoc allocation', () => {
  test('S5.1-S5.2 TD activates project with SPOC, SPOC verifies', async ({ page, request }) => {
    const td = byKey('td');
    const dmh = byKey('dmh');
    const spoc = byKey('spoc');

    // Resolve DT-2601 id via API (TD session).
    await apiLogin(request, td.email, TEST_PASSWORD);
    const found = await request.get(`${apiUrl()}/api/projects?search=${encodeURIComponent('DT-2601')}`);
    expect(found.ok()).toBeTruthy();
    const body = await found.json();
    const items: Array<{ _id: string; code: string }> = body.projects ?? body.items ?? [];
    const project = items.find((p) => p.code === 'DT-2601');
    expect(project, 'DT-2601 exists').toBeTruthy();
    const projectId = project!._id;
    await apiLogout(request);

    // S5.1 TD activates the project with Ananya Rao as SPOC (Project Detail UI).
    await signIn(page, td.email, TEST_PASSWORD);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText('Open this project for a team').first()).toBeVisible({ timeout: 20_000 });
    const coordSelect = page.locator('#pd-spoc');
    await expect(coordSelect).toBeAttached({ timeout: 20_000 });
    await selectOptionContaining(coordSelect, 'Ananya Rao');
    await page.getByRole('button', { name: 'Activate project' }).click();
    // Activation assigns the SPOC (allocation is created as Approved).
    await expect(page.getByText(/^Activated/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);

    // The allocation exists and is already Approved (DMH can read it).
    await apiLogin(request, dmh.email, TEST_PASSWORD);
    const list = await request.get(`${apiUrl()}/api/spoc/allocations?project=${projectId}`);
    expect(list.ok()).toBeTruthy();
    const allocs: Array<{ _id: string; status: string }> = (await list.json()).items ?? [];
    expect(allocs.some((a) => a.status === 'Approved'), 'approved SPOC allocation').toBeTruthy();
    await apiLogout(request);

    // SPOC verifies: My Coordination → "1 allocated project(s)".
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    await expect(page.getByText('My Coordination').first()).toBeVisible();
    await expect(page.getByText(/1 allocated project\(s\)/i).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});
