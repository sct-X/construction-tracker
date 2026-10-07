/**
 * Two projects, same specs:
 *   mock  vite preview of the Pages build (mock data in the browser), port 4320
 *   api   the api-mode build served by the local server (`npm run e2e:server`:
 *         port 4310, CT_TODAY=2026-09-17, seeded temp DB)
 *   api-change  runs after api, on the same server: applies the windows ETA
 *         change with `npm run apply-op` and checks the Monday screen moved.
 *         It changes the data, so it is the only spec in its project.
 * Only the servers for the projects asked for are started, so
 * `npx playwright test --project=mock` never needs the API. If the root
 * package.json has no `e2e:server` script yet, the api project is pending:
 * its tests are skipped with a reason rather than failing.
 */
import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const rootPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };
const apiServerReady = Boolean(rootPkg.scripts?.['e2e:server']);

function requestedProjects(): Set<string> | null {
  const names: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--project' && argv[i + 1]) names.push(argv[i + 1]!);
    else if (a.startsWith('--project=')) names.push(a.slice('--project='.length));
  }
  return names.length ? new Set(names) : null;
}

const wanted = requestedProjects();
const runMock = !wanted || wanted.has('mock');
const runApi = (!wanted || [...wanted].some((n) => n.startsWith('api'))) && apiServerReady;

const MOCK_URL = 'http://localhost:4320/construction-tracker/';
const API_URL = 'http://localhost:4310/';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    timezoneId: 'Australia/Sydney',
    locale: 'en-AU',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mock', testIgnore: /api-change/, use: { baseURL: MOCK_URL }, metadata: { dataMode: 'mock' } },
    { name: 'api', testIgnore: /api-change/, use: { baseURL: API_URL }, metadata: { dataMode: 'api', pending: !apiServerReady } },
    {
      name: 'api-change',
      testMatch: /api-change\.spec\.ts/,
      dependencies: ['api'],
      use: { baseURL: API_URL },
      metadata: { dataMode: 'api', pending: !apiServerReady },
    },
  ],
  webServer: [
    ...(runMock
      ? [
          {
            command: 'npm run build:pages -w @ct/web && npm run preview:pages -w @ct/web',
            url: MOCK_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
    ...(runApi
      ? [
          {
            command: 'npm run build -w @ct/web && npm run e2e:server',
            url: `${API_URL}api/health`,
            // Never reuse: api-change edits the data, and the server wipes its DATA_DIR on start.
            reuseExistingServer: false,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
