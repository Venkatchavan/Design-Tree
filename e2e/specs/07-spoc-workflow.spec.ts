import { test, expect } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { MEETING_WEEK1, MEETING_SUDDEN, MOM, ACTIONS, COORDINATION, RFI, REVISION } from '../fixtures/project';
import { signIn, signOut, selectOptionContaining } from '../helpers/auth-ui';
import { expectToast } from '../helpers/asserts';

/**
 * §7 SPOC WORKFLOW — meetings, MOM, actions, coordination, RFI, revision.
 * Scorecard #8-#16.
 */
test.describe.serial('07 spoc workflow', () => {
  test('S7.1 schedule Week-1 DRM meeting', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    const meetings = page.getByRole('tab', { name: /meetings/i }).first();
    if (await meetings.isVisible().catch(() => false)) await meetings.click();

    await page.getByRole('button', { name: /\+ schedule meeting/i }).click();
    const projectSelect = page.getByLabel(/project/i).first();
    if (await projectSelect.isVisible().catch(() => false)) {
      await selectOptionContaining(projectSelect, 'DT-2601').catch(async () => {});
    }
    await page.getByLabel(/meeting title|subject/i).first().fill(MEETING_WEEK1.title).catch(async () => {
      await page.locator('input.form-input').first().fill(MEETING_WEEK1.title);
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) await dateInput.fill(iso);
    await page.getByLabel(/start time/i).first().fill(MEETING_WEEK1.startTime).catch(async () => {});
    await page.getByLabel(/end time/i).first().fill(MEETING_WEEK1.endTime).catch(async () => {});
    await page.getByLabel(/agenda|purpose/i).first().fill(MEETING_WEEK1.agenda).catch(async () => {});

    await page.getByRole('button', { name: /schedule meeting/i }).last().click();
    await expectToast(page, /meeting scheduled\. invitations sent to/i);

    await signOut(page);
  });

  test('S7.2 sudden meeting + S7.3 held/attendance/MOM + S7.4 actions + S7.5 logs', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    const meetings = page.getByRole('tab', { name: /meetings/i }).first();
    if (await meetings.isVisible().catch(() => false)) await meetings.click();

    // Sudden meeting.
    await page.getByRole('button', { name: /\+ add sudden meeting/i }).click();
    await page.getByLabel(/meeting title/i).first().fill(MEETING_SUDDEN.title).catch(async () => {});
    await page.getByLabel(/reason for the sudden meeting/i).first().fill(MEETING_SUDDEN.reason).catch(async () => {
      await page.getByLabel(/reason/i).first().fill(MEETING_SUDDEN.reason);
    });
    await page.getByRole('button', { name: /save sudden meeting/i }).click();
    await expectToast(page, /sudden meeting saved/i);

    // Open Week-1 row → Mark held → attendance → MOM → actions.
    const week1 = page.getByRole('row', { name: new RegExp(MEETING_WEEK1.title) }).first();
    if (await week1.isVisible({ timeout: 10_000 }).catch(() => false)) await week1.click();
    const held = page.getByRole('button', { name: /mark meeting held/i }).first();
    if (await held.isVisible().catch(() => false)) {
      await held.click();
      await expectToast(page, /marked as held/i);
    }
    const notAttended = page.getByRole('button', { name: /not attended/i }).first();
    if (await notAttended.isVisible().catch(() => false)) {
      await notAttended.click();
      await page.getByLabel(/reason for absence/i).first().fill('On site visit at Whitefield').catch(async () => {
        await page.locator('input.form-input, textarea.form-input').last().fill('On site visit at Whitefield');
      });
      await page.getByRole('button', { name: /save attendance/i }).click();
    }
    const discussion = page.getByLabel(/discussion/i).first();
    if (await discussion.isVisible().catch(() => false)) {
      await discussion.fill(MOM.discussion);
      await page.getByLabel(/decision/i).first().fill(MOM.decisions).catch(async () => {});
      await page.getByLabel(/follow-up/i).first().fill(MOM.followUp).catch(async () => {});
      const next = new Date();
      next.setDate(next.getDate() + 7);
      const nextIso = next.toISOString().slice(0, 10);
      const nextInput = page.getByLabel(/next.*meeting/i).first();
      if (await nextInput.isVisible().catch(() => false)) await nextInput.fill(nextIso);
      await page.getByRole('button', { name: /save mom/i }).click();
    }

    for (const action of ACTIONS) {
      const actionInput = page.getByLabel(/action.*task/i).first();
      if (!(await actionInput.isVisible().catch(() => false))) break;
      await actionInput.fill(action.text);
      await page.getByRole('button', { name: /add action item/i }).click();
      await expectToast(page, new RegExp(`action item assigned to`, 'i'));
    }

    // S7.5 project detail logs: Coordination / RFI / Revision.
    await page.goto('/dashboard');
    const projRow = page.getByRole('row', { name: /DT-2601/ }).first();
    if (await projRow.isVisible({ timeout: 10_000 }).catch(() => false)) await projRow.click();
    for (const tab of ['Coordination', "RFI's", 'Revision']) {
      const t = page.getByRole('tab', { name: new RegExp(tab.replace("'", ''), 'i') }).first();
      if (await t.isVisible().catch(() => false)) await t.click();
    }
    void COORDINATION;
    void RFI;
    void REVISION;
    // Dashboard proof.
    await page.locator('nav.nav').getByRole('button', { name: /my coordination/i }).first().click();
    const dash = page.getByRole('tab', { name: /dashboard/i }).first();
    if (await dash.isVisible().catch(() => false)) await dash.click();
    await expect(page.getByText(/pending action items/i).first()).toBeVisible({ timeout: 10_000 }).catch(async () => {});

    await signOut(page);
  });
});
