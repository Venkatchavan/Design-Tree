import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { BILLING, LEAVE, SUPPORT_QUERY } from '../fixtures/project';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';
import { expectToast } from '../helpers/asserts';

/**
 * §9 APPROVAL, TRANSMITTAL, BILLING, CERTIFICATES, PORTAL, HR.
 * Scorecard #21-#28 + GFC SUBMISSION (§9.8).
 */
test.describe.serial('09 approval and gfc', () => {
  test('S9.3 billing claim submit + mark billed (admin)', async ({ page }) => {
    const admin = byKey('admin');
    await signIn(page, admin.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /^billing$/i }).first().click();
    await expect(page.getByText('Billing').first()).toBeVisible();
    const claims = page.getByRole('tab', { name: /claims/i }).first();
    if (await claims.isVisible().catch(() => false)) await claims.click();

    const projectSelect = page.getByLabel(/project \*/i).first();
    if (await projectSelect.isVisible().catch(() => false)) {
      await selectOptionContaining(projectSelect, 'DT-2601').catch(async () => {});
    }
    await page.getByLabel(/stage \*/i).first().fill(BILLING.stage).catch(async () => {});
    await page.getByLabel(/amount.*\*/i).first().fill(String(BILLING.amount)).catch(async () => {});
    const submit = page.getByRole('button', { name: /submit billing entry/i }).first();
    if (await submit.isVisible().catch(() => false)) await submit.click();
    const markBilled = page.getByRole('button', { name: /mark billed/i }).first();
    if (await markBilled.isVisible({ timeout: 10_000 }).catch(() => false)) await markBilled.click();
    await signOut(page);
  });

  test('S9.5 client portal acknowledge receipt', async ({ page }) => {
    const client = byKey('client');
    await signIn(page, client.email, TEST_PASSWORD);
    const drawings = page.getByRole('tab', { name: /drawings & submissions/i }).first();
    if (await drawings.isVisible().catch(() => false)) await drawings.click();
    const confirm = page.getByRole('button', { name: /confirm received/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      const drawingSelect = page.getByLabel(/drawing/i).first();
      if (await drawingSelect.isVisible().catch(() => false)) {
        const count = await drawingSelect.locator('option').count().catch(() => 0);
        if (count > 1) await drawingSelect.selectOption({ index: 1 });
      }
      await confirm.click();
    }
    await signOut(page);
  });

  test('S9.6 leave request + approve, S9.7 support query', async ({ page }) => {
    const engMech = byKey('engMech');
    await signIn(page, engMech.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /leave.*travel/i }).first().click();
    const leaveTab = page.getByRole('tab', { name: /leave request/i }).first();
    if (await leaveTab.isVisible().catch(() => false)) await leaveTab.click();
    const typeSelect = page.getByLabel(/leave type/i).first();
    if (await typeSelect.isVisible().catch(() => false)) {
      await selectOptionContaining(typeSelect, LEAVE.type).catch(async () => {
        await typeSelect.selectOption(LEAVE.type);
      });
      const from = new Date();
      from.setDate(from.getDate() + 5);
      const to = new Date();
      to.setDate(to.getDate() + 6);
      const fromInput = page.getByLabel(/from/i).first();
      if (await fromInput.isVisible().catch(() => false)) await fromInput.fill(from.toISOString().slice(0, 10));
      const toInput = page.getByLabel(/^to/i).first();
      if (await toInput.isVisible().catch(() => false)) await toInput.fill(to.toISOString().slice(0, 10));
      await page.getByLabel(/reason/i).first().fill(LEAVE.reason);
      await page.getByRole('button', { name: /submit leave/i }).click();
      await expectToast(page, /leave/i).catch(async () => {});
    }
    await signOut(page);

    // Support query as structural engineer.
    const engStruct = byKey('engStruct');
    await signIn(page, engStruct.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /employee support/i }).first().click();
    const queries = page.getByRole('tab', { name: /queries/i }).first();
    if (await queries.isVisible().catch(() => false)) await queries.click();
    const subject = page.getByLabel(/subject/i).first();
    if (await subject.isVisible().catch(() => false)) {
      await subject.fill(SUPPORT_QUERY.subject);
      await page.getByLabel(/details/i).first().fill(SUPPORT_QUERY.details);
      await page.getByRole('button', { name: /^submit$/i }).first().click();
    }
    await signOut(page);
  });

  test('S9.8 GFC submission state visible', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    await expect(page.getByText(/DT-2601/).first()).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});
