import { defineConfig, devices } from '@playwright/test';

// PW_PORT lets parallel agents run their own preview server; PW_OUT keeps their
// test-results apart. Defaults match CI and a single local run.
const PORT = Number(process.env.PW_PORT ?? 4173);
const OUT = process.env.PW_OUT ?? 'test-results';

// Runs against the built app served by `vite preview`, exactly as Pages serves it.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  outputDir: OUT,
  use: {
    baseURL: `http://localhost:${PORT}/construction-tracker/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/construction-tracker/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
