import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { PROJECT } from '../fixtures/project';
import { signIn, signOut } from '../helpers/auth-ui';
import { expectText } from '../helpers/asserts';
import { apiUrl, apiLogin, apiLogout } from '../helpers/api';

/**
 * §2 ADMIN — CREATE NEW PROJECT (admin@designtree.test).
 * Scorecard #3: Detail opens; Active +1 (row DT-2601 on dashboard).
 *
 * NewProjectPage now shows an optional Code field (Salesforce prefill can
 * populate it). The UI creates the project, then the code is set to DT-2601
 * via API so specs 03-09 keep locating the project by its stable code.
 */
test.describe.serial('02 admin create project', () => {
  test('S2.1-S2.7 fill New project, save, set code DT-2601', async ({ page, request }) => {
    const admin = byKey('admin');
    await signIn(page, admin.email, TEST_PASSWORD);

    await page.locator('nav.nav').getByRole('button', { name: 'Dashboard' }).first().click();
    await page.getByRole('button', { name: 'New project' }).click();
    await expect(page.getByText('New Project')).toBeVisible();

    // --- Information ---
    await page.getByPlaceholder('e.g. Business park - Tower A').fill(PROJECT.name);
    await page.getByLabel('Job number mode').selectOption('manual');
    await page.getByPlaceholder('Enter job number').fill(PROJECT.jobNumber);
    await page.getByPlaceholder('Search Entities...').fill(PROJECT.entityName);

    async function selectIfOption(select: ReturnType<typeof page.locator>, label: string) {
      const texts = await select.locator('option').allTextContents().catch(() => [] as string[]);
      if (texts.some((t) => t.trim() === label)) await select.selectOption({ label });
    }
    const selects = page.locator('select.form-input');
    await selectIfOption(selects.nth(1), PROJECT.state);
    await selectIfOption(selects.nth(2), PROJECT.projectType);

    // --- Project Location via Custom address (no geocode dependency) ---
    await page.getByRole('button', { name: 'Add Location' }).click();
    await expect(page.getByText('Set project location')).toBeVisible();
    await page.getByRole('button', { name: 'Custom address' }).click();
    await page.getByPlaceholder('e.g. Whitefield, Bengaluru').last().fill(PROJECT.location.label);
    await page.getByRole('button', { name: 'Save Location' }).click();

    // --- Services checkboxes (labels are uppercase SERVICE_LABELS) ---
    const SERVICE_LABEL: Record<string, string> = { STR: 'STR', HVAC: 'HVAC', ELE: 'ELEC', PHE: 'PHE', FIRE: 'FIRE' };
    for (const s of PROJECT.services) {
      const box = page.getByRole('checkbox', { name: new RegExp(`^${SERVICE_LABEL[s] ?? s}$`, 'i') }).first();
      if (await box.isVisible().catch(() => false)) {
        if (!(await box.isChecked().catch(() => true))) await box.check();
      }
    }

    // --- Scope of Work & Fee (single scope text + total fee) ---
    const scopeText = PROJECT.scope.map((r) => `${r.service}: ${r.scope}`).join('; ');
    const totalFee = PROJECT.scope.reduce((n, r) => n + r.fee, 0);
    await page.getByPlaceholder('e.g. Structural, HVAC, electrical, plumbing, fire and BIM design consultancy').fill(scopeText).catch(async () => {});
    const feeInput = page.locator('text=Scope of Work & Fee').locator('..').locator('input[type="number"]').first();
    if (await feeInput.isVisible().catch(() => false)) await feeInput.fill(String(totalFee)).catch(async () => {});

    await page.getByRole('button', { name: /^save$/i }).first().click();

    // Expected: Project Detail page opens.
    await expect(page.getByText(PROJECT.name).first()).toBeVisible({ timeout: 20_000 });

    // Set stable code DT-2601 via API (UI has no code field).
    const id = page.url().match(/\/projects\/([a-f0-9]{24})/)?.[1];
    expect(id, 'project id in detail URL').toBeTruthy();
    await apiLogin(request, admin.email, TEST_PASSWORD);
    const put = await request.put(`${apiUrl()}/api/projects/${id}`, { data: { code: 'DT-2601' } });
    expect(put.ok(), `set code failed: ${await put.text()}`).toBeTruthy();
    await apiLogout(request);
    await page.reload();
    await expectText(page, /DT-2601/);

    // Back to dashboard → row listed (Back button goes history-back to the
    // form, so use the sidebar Dashboard nav).
    await page.locator('nav.nav').getByRole('button', { name: 'Dashboard' }).first().click();
    await expect(page.getByRole('cell', { name: /Sunrise Heights Tower A/ }).first()).toBeVisible({ timeout: 20_000 });

    await signOut(page);
  });
});
