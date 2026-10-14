import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';
import { apiUrl, apiLogin, apiLogout } from '../helpers/api';

/**
 * §5 SPOC ALLOCATION → PROJECT ACTIVATION.
 * New flow: Technical Director proposes SPOC on Project Detail
 * (UI) → Design Management Head approves (API — no approve UI exists)
 * → SPOC sees the allocation (UI).
 * Scorecard #6: Overview "1 allocated project(s)".
 */
test.describe.serial('05 spoc allocation', () => {
  test('S5.1-S5.2 TD proposes SPOC, DMH approves, SPOC verifies', async ({ page, request }) => {
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

    // S5.1 TD proposes Ananya Rao as SPOC (Project Detail UI).
    await signIn(page, td.email, TEST_PASSWORD);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText('SPOC for this project').first()).toBeVisible({ timeout: 20_000 });
    const coordSelect = page.locator('#td-spoc-coord');
    await expect(coordSelect).toBeVisible({ timeout: 20_000 });
    await selectOptionContaining(coordSelect, 'Ananya Rao');
    await page.getByRole('button', { name: /propose spoc/i }).first().click();
    // Allocations table must show the persisted Proposed row (not just the
    // panel subtitle, which always contains "SPOC proposed").
    const row = page.getByRole('row', { name: /Ananya Rao.*Proposed|Proposed.*Ananya Rao/ }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await signOut(page);

    // S5.2 DMH approves the Proposed allocation (API).
    await apiLogin(request, dmh.email, TEST_PASSWORD);
    const list = await request.get(`${apiUrl()}/api/spoc/allocations?project=${projectId}`);
    expect(list.ok()).toBeTruthy();
    const allocs: Array<{ _id: string; status: string }> = (await list.json()).items ?? [];
    const proposed = allocs.find((a) => a.status === 'Proposed') ?? allocs[0];
    expect(proposed, 'allocation proposed').toBeTruthy();
    const approve = await request.patch(`${apiUrl()}/api/spoc/allocations/${proposed!._id}`, {
      data: { status: 'Approved' },
    });
    expect(approve.ok(), `approve failed: ${await approve.text()}`).toBeTruthy();
    await apiLogout(request);

    // SPOC verifies: My Coordination → "1 allocated project(s)".
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    await expect(page.getByText('My Coordination').first()).toBeVisible();
    await expect(page.getByText(/1 allocated project\(s\)/i).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});
