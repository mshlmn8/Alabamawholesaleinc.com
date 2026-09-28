// Playwright smoke tests (AW-209): `npm run test:e2e` builds the site and runs
// tests/smoke against `vite preview`. The production build needs the Supabase
// variables (AW-053); the specs block every non-local request, so they never
// reach a real backend and dummy values are enough in CI.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.SMOKE_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const PREVIEW = `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    // CI builds once in an earlier step and sets SMOKE_SKIP_BUILD.
    command: process.env.SMOKE_SKIP_BUILD ? PREVIEW : `npm run build && ${PREVIEW}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Vite skips opening a browser when BROWSER is "none".
    env: { BROWSER: 'none' }
  }
});
