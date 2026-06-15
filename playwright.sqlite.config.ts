import { defineConfig, devices } from '@playwright/test'

/**
 * SQLite E2E tests
 *
 * These tests run against a local SQLite database, allowing developers to test
 * the full user workflow without requiring Azure infrastructure.
 *
 * Prerequisites:
 * - Set DATABASE_URL to use SQLite: DATABASE_URL="sqlite:./test.db"
 * - Start the dev server: npm run dev
 * - Run tests: npm run test:e2e:sqlite
 *
 * The tests create and clean up their own test data, making them fully isolated.
 */

export default defineConfig({
  testDir: './tests/e2e/sqlite',
  testIgnore: [],
  fullyParallel: false,
  forbidOnly: process.env.CI ? true : false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
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
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
