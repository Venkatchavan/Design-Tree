import { expect, type Page } from '@playwright/test';

/**
 * UI auth helpers (§0.2-§0.3).
 * Selectors verified against web/src/pages/LoginPage.jsx + layout/Sidebar.jsx.
 */

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await expect(page.getByText('DesignTree workspace')).toBeVisible();
  await expect(page.getByText('Sign in with your work account to continue.')).toBeVisible();
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginPassword').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Post-login: either the sidebar appears, or (after 09:45 IST) the late
  // sign-in modal does. Wait for either, then clear the modal if present.
  const sidebar = page.locator('aside.sidebar, nav.nav').first();
  const lateTitle = page.getByText('You signed in after 9:45');
  await expect(sidebar.or(lateTitle)).toBeVisible({ timeout: 20_000 });
  if (await lateTitle.isVisible().catch(() => false)) {
    const reason = page.getByPlaceholder(/train delayed/i).first();
    if (await reason.isVisible().catch(() => false)) {
      await reason.fill('E2E late sign-in');
    } else {
      const legacy = page.locator('textarea').first();
      if (await legacy.isVisible().catch(() => false)) await legacy.fill('E2E late sign-in');
    }
    await page.getByRole('button', { name: /save reason & continue/i }).click();
  }
  // Login button briefly reads "Signing in..." then sidebar appears.
  await expect(sidebar).toBeVisible({ timeout: 20_000 });
}

export async function signOut(page: Page) {
  // Session end via API: the server enforces attendance reasons but not the
  // man-hour UI flow, so this is equivalent to signing out through every
  // gate with reasons supplied. UI gate-clicking is covered by dedicated
  // specs (09 leave/support); every other spec just needs a clean sign-out.
  await page.request.post('/api/auth/logout', {
    data: { earlyLogoutReason: 'E2E early sign-out', lateReason: 'E2E late sign-in' },
  }).catch(() => null);
  await page.goto('/');
  await expect(page.getByText('DesignTree workspace')).toBeVisible({ timeout: 20_000 });
}

async function clearAttendanceGate(page: Page) {
  // Attendance gate: late sign-in (9:45 IST) / early sign-out (< 8 hours)
  // needs a reason. Fill visible reason fields and confirm.
  const gate = page.getByText('A reason is needed to sign out');
  if (!(await gate.isVisible({ timeout: 3_000 }).catch(() => false))) return;
  const lateBox = page.getByText('Reason for late sign-in');
  if (await lateBox.isVisible().catch(() => false)) {
    await page.locator('textarea').first().fill('E2E late sign-in');
  }
  const earlyBox = page.getByText('Reason for early sign-out');
  if (await earlyBox.isVisible().catch(() => false)) {
    await page.locator('textarea').last().fill('E2E early sign-out');
  }
  await page.getByRole('button', { name: /save reason & sign out/i }).click();
}

async function logMinimalHours(page: Page) {
  // Update work progress page: Project * + Hours * + Submit for team lead action.
  // Best-effort: only if the form is present.
  const hours = page.locator('input[name="hours"], input[placeholder*="Hours"]').first();
  if (await hours.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await hours.fill('4');
    const remarks = page.locator('textarea, input[name="remarks"]').first();
    if (await remarks.isVisible().catch(() => false)) await remarks.fill('E2E sign-out hours');
    const submit = page.getByRole('button', { name: /submit for team lead action|submit today/i }).first();
    if (await submit.isVisible().catch(() => false)) await submit.click();
  }
}

export async function gotoNav(page: Page, label: string | RegExp) {
  await page.locator('nav.nav').getByRole('button', { name: label }).first().click();
}

/**
 * Select a <select> option whose visible text contains `text`.
 * Playwright selectOption label matching is exact-string only, so we
 * resolve the value manually (works for "DT-2601 - Sunrise Heights Tower A").
 */
export async function selectOptionContaining(
  select: import('@playwright/test').Locator,
  text: string,
) {
  const options = select.locator('option');
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const label = ((await options.nth(i).textContent()) ?? '').trim();
    if (label.includes(text)) {
      const value = (await options.nth(i).getAttribute('value')) ?? label;
      await select.selectOption(value);
      return label;
    }
  }
  // Fallback: try exact label string.
  await select.selectOption({ label: text });
  return text;
}
