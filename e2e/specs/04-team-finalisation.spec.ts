import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { signIn, signOut } from '../helpers/auth-ui';
import { apiLogin, apiLogout, ensureBranchViaApi, ensureProjectViaApi, getEmployeeIdMap, ensureTeamsViaApi } from '../helpers/api';
import { PROJECT } from '../fixtures/project';

/**
 * §4 PROJECT TEAM FINALISATION — 3 teams + members.
 * Scorecard #5: teams created; directory lists the project and member count.
 * Verified UI fact (F-01): Teams page is cards-only, no Create button.
 * Creation is POST /api/teams (admin session), verification is UI.
 */
test.describe.serial('04 team finalisation', () => {
  test('S4.1 create 3 teams via API then S4.2 verify in UI', async ({ page, request }) => {
    const admin = byKey('admin');
    await apiLogin(request, admin.email, TEST_PASSWORD);
    const { id: projectId } = await ensureProjectViaApi(request, {
      name: PROJECT.name,
      code: PROJECT.code,
      state: PROJECT.state,
      projectType: PROJECT.projectType,
      branch: PROJECT.branch,
      services: [...PROJECT.services],
      source: PROJECT.source,
      entityName: PROJECT.entityName,
      location: { label: PROJECT.location.label, city: PROJECT.location.city, zip: PROJECT.location.zip },
      jobNumber: PROJECT.jobNumber,
      scope: [...PROJECT.scope],
    });
    const ids = await getEmployeeIdMap(request);
    await ensureBranchViaApi(request, 'Bengaluru HQ');
    for (const [who, id] of Object.entries(ids)) expect(id, `employee id for ${who}`).toBeTruthy();
    await ensureTeamsViaApi(request, projectId, {
      arjun: ids.arjun,
      karthik: ids.karthik,
      meera: ids.meera,
      ananya: ids.ananya,
    });
    await apiLogout(request);

    // S4.2 Verify in UI (still Admin).
    await signIn(page, admin.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /^teams$/i }).first().click();
    await expect(page.getByText('Teams').first()).toBeVisible();
    // Teams is now a company directory: filters plus a project table.
    await expect(page.getByText('Find company teams').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/1 projects · 10 members/).first()).toBeVisible({ timeout: 20_000 });
    const row = page.getByRole('row', { name: /JOB-2601.*Sunrise Heights Tower A/ }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Structural');
    await expect(page.getByText('Project team log').first()).toBeVisible();
    await signOut(page);
  });
});
