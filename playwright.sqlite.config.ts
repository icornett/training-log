import { defineConfig, devices } from '@playwright/test'

/**
 * Local DB E2E tests
 *
 * Runs the full user workflow against a local Dockerized Postgres database
 * without Azure infrastructure.
 *
 * `npm run db:local:prepare` ensures local Postgres is running and seeded.
 * `swa start ./dist --api-devserver-url http://127.0.0.1:7071` serves built
 * static files and proxies API calls to local Azure Functions.
 *
 * Prerequisites:
 *   1. Install Docker and make sure it is running.
 *   2. Run: npm run build        (builds frontend to ./dist)
 *      Run: npm run build:api    (compiles API TypeScript)
 *
 * Playwright auto-starts the full stack when you run:
 *   npm run test:e2e:sqlite
 *
 * Or start it manually and reuse across runs:
 *   npm run db:local:prepare
 *   npm run dev:sqlite:stack
 *   BASE_URL=http://127.0.0.1:4280 npm run test:e2e:sqlite
 */

const sqliteBaseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4280'

export default defineConfig({
  testDir: './tests/e2e/sqlite',
  testIgnore: [],
  fullyParallel: false,
  forbidOnly: process.env.CI ? true : false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: sqliteBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // Playwright prepares local DB, builds app/API, then starts API+SWA stack.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command:
          'npm run db:local:prepare && npm run build && npm run build:api && DISABLE_TIMER_TRIGGERS=true FUNCTIONS_WORKER_RUNTIME=node SESSION_SECRET=sqlite-local-session-secret npm run dev:sqlite:stack',
        url: sqliteBaseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
