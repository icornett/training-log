import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BASE_URL
const authFile = 'tests/e2e/.auth/real-db-user.json'

if (!baseURL) {
  throw new Error('BASE_URL environment variable is required for real-db tests')
}

export default defineConfig({
  testDir: './tests/e2e/real-db',
  globalSetup: './tests/e2e/real-db/global-setup.ts',
  globalTeardown: './tests/e2e/real-db/global-teardown.ts',
  testIgnore: ['**/global-setup.ts', '**/global-teardown.ts'],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  retries: 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/real-db-junit.xml' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    storageState: authFile,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'safari',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'ios-safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'android-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
