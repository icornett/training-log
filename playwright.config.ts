import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/real-db/**',
  timeout: 30_000,
  expect: {
    timeout: process.env.CI ? 10_000 : 5_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [
        ['list'],
        ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
        ['html', { open: 'never' }],
      ]
    : 'html',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ios-safari',
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'android-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev:web -- --host 127.0.0.1 --port 4173',
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
})
