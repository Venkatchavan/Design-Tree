import { expect, type Page } from '@playwright/test';

/** Judging rule (§0.6): a step passes ONLY if the stated on-screen result appears. */

export async function expectToast(page: Page, text: string | RegExp) {
  // Toasts render at the bottom of the viewport.
  await expect(page.getByText(text).last()).toBeVisible({ timeout: 15_000 });
}

export async function expectTableRow(page: Page, text: string | RegExp) {
  await expect(page.getByRole('row', { name: text }).first()).toBeVisible();
}

export async function expectText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

export async function fillTomorrowDate(page: Page, locator: string): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  await page.locator(locator).fill(iso);
  return iso;
}

export async function fillDatePlusDays(page: Page, locator: string, days: number): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const iso = d.toISOString().slice(0, 10);
  await page.locator(locator).fill(iso);
  return iso;
}
