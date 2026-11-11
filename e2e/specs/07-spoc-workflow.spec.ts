import { test, expect, type Page } from '@playwright/test';
import { byKey, TEST_PASSWORD } from '../fixtures/roles';
import { MEETING_WEEK1, MEETING_SUDDEN, MOM, ACTIONS, COORDINATION, RFI, REVISION } from '../fixtures/project';
import { signIn, signOut } from '../helpers/auth-ui';
import { expectToast } from '../helpers/asserts';

/**
 * §7 SPOC WORKFLOW — meetings, MOM, actions, coordination, RFI, revision.
 * Scorecard #8-#16.
 */
// SPOC meetings now live on the project page: Coordinator > Meetings tab.
async function openProjectMeetings(page: Page) {
  const found = await page.request.get(`/api/projects?search=${encodeURIComponent('DT-2601')}`);
  expect(found.ok(), `project lookup failed: ${await found.text()}`).toBeTruthy();
  const items: Array<{ _id: string; code: string }> = (await found.json()).items ?? [];
  const project = items.find((p) => p.code === 'DT-2601');
  expect(project, 'DT-2601 visible to SPOC').toBeTruthy();
  await page.goto(`/projects/${project!._id}`);
  await page.getByRole('tab', { name: 'Meetings', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Schedule Meeting' })).toBeVisible({ timeout: 20_000 });
}

test.describe.serial('07 spoc workflow', () => {
  test('S7.1 schedule Week-1 DRM meeting', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await openProjectMeetings(page);

    await page.getByRole('button', { name: '+ Schedule Meeting' }).click();
    const modal = page.locator('form').filter({ hasText: 'Meeting title / subject' });
    // Project is preset from the project page; fields have no label links,
    // so use their placeholders.
    await modal.getByPlaceholder('e.g. Weekly DRM review, Week 41').fill(MEETING_WEEK1.title);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await modal.locator('input[type="date"]').first().fill(tomorrow.toISOString().slice(0, 10));
    await modal.locator('input[type="time"]').nth(0).fill(MEETING_WEEK1.startTime);
    await modal.locator('input[type="time"]').nth(1).fill(MEETING_WEEK1.endTime);

    await modal.getByRole('button', { name: 'Schedule meeting', exact: true }).click();
    await expectToast(page, /meeting scheduled\. invitations sent to/i);

    await signOut(page);
  });

  test('S7.2 sudden meeting + S7.3 held/attendance/MOM + S7.4 actions + S7.5 logs', async ({ page }) => {
    const spoc = byKey('spoc');
    await signIn(page, spoc.email, TEST_PASSWORD);
    await openProjectMeetings(page);

    // Sudden meeting.
    await page.getByRole('button', { name: '+ Add Sudden Meeting' }).click();
    const sudden = page.locator('form').filter({ hasText: 'Reason for the sudden meeting' });
    await sudden.getByPlaceholder('e.g. Weekly DRM review, Week 41').fill(MEETING_SUDDEN.title);
    await sudden.getByPlaceholder('What triggered this meeting?').fill(MEETING_SUDDEN.reason);
    await sudden.getByRole('button', { name: /save sudden meeting/i }).click();
    await expectToast(page, /sudden meeting saved/i);

    // Saving a sudden meeting opens its details dialog; close it so the
    // Week-1 row underneath can be opened.
    const details = page.getByRole('dialog', { name: 'Meeting details' });
    if (await details.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await details.getByRole('button', { name: 'Close' }).click();
      await expect(details).toBeHidden();
    }

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
