import { expect, type Page } from '@playwright/test'

export const REAL_DB_AUTH_FILE = 'tests/e2e/.auth/real-db-user.json'

const SEEDED_USERNAME = 'Playwright User'
const SEEDED_PASSWORD = 'playwright-pass-123'

export const loginAsSeededUser = async (page: Page): Promise<void> => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

  await page.getByLabel('Username').fill(SEEDED_USERNAME)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText(SEEDED_USERNAME)).toBeVisible()
}

export const clearAuthState = async (page: Page): Promise<void> => {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}
