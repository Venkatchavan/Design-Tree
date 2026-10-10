import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load e2e/.env first, fall back to repo-root ../.env / api defaults.
dotenv.config({ path: path.resolve(import.meta.dirname, '.env') });
dotenv.config({ path: path.resolve(import.meta.dirname, '..', '.env') });

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';

/**
 * Local-dev e2e (per user choice):
 *   web  -> http://localhost:5173 (vite dev, /api proxied to :5000)
 *   api  -> http://localhost:5000
  *   mongo -> local isolated DB (designtree-e2e), seeded with superuser only.
 *
 * Workflow is strictly serial (sign-in -> sign-out per role, §0.3), so
 * workers:1 + fullyParallel:false. Spec files run alphabetically 01..09.
 */
export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: {},
  },
  projects: [
    { name: 'workflow', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: undefined, // api + web are started manually (see README).
  metadata: { apiUrl: API_URL },
});
