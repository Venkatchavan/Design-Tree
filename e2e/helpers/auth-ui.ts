import { expect, type Page } from '@playwright/test';

/**
 * UI auth helpers (§0.2-§0.3).
 * Selectors verified against web/src/pages/LoginPage.jsx + layout/Sidebar.jsx.
 */

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await expect(page.getByText('Sign in to DesignTree')).toBeVisible();
  await expect(page.getByText('Enter your work email and password to continue.')).toBeVisible();
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginPassword').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Login button briefly reads "Signing in..." then sidebar appears.
  await expect(page.locator('aside.sidebar, nav.nav').first()).toBeVisible({ timeout: 20_000 });
}

export async function signOut(page: Page) {
  const footer = page.locator('.sidebar-footer');
  await expect(footer).toBeVisible();
  // LogOut icon button at far right of footer row.
  const logoutBtn = footer.getByRole('button').last();
  await logoutBtn.click();
  // Man-hour gate: Engineer/Drafter + Coordinator without today's hours
  // are bounced to hours entry. Handle both branches deterministically.
  const gate = page.getByText('Man-hour entry is mandatory before you sign out.');
  if (await gate.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // Prefer override for super roles, else go to entry and log minimal hours.
    const override = page.getByRole('button', { name: /sign out anyway/i });
    if (await override.isVisible().catch(() => false)) {
      await override.click();
    } else {
      const takeMe = page.getByRole('button', { name: /take me to entry/i });
      if (await takeMe.isVisible().catch(() => false)) {
        await takeMe.click();
        await logMinimalHours(page);
        await footer.getByRole('button').last().click();
      }
    }
  }
  await expect(page.getByText('Sign in to DesignTree')).toBeVisible({ timeout: 20_000 });
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
