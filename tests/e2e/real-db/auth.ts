import { expect, type Page } from '@playwright/test'

export const REAL_DB_AUTH_FILE = 'tests/e2e/.auth/real-db-user.json'

const SEEDED_PASSWORD = 'playwright-pass-123'

const SEEDED_USERNAMES_BY_PROJECT: Record<string, string> = {
  'ios-safari': 'Playwright User iOS',
  'android-chrome': 'Playwright User Android',
  chromium: 'Playwright User Chromium',
  safari: 'Playwright User Safari',
}

export const getSeededUsername = (projectName?: string): string => {
  if (!projectName) {
    return 'Playwright User iOS'
  }

  return SEEDED_USERNAMES_BY_PROJECT[projectName] ?? 'Playwright User iOS'
}

export const loginAsSeededUser = async (page: Page, projectName?: string): Promise<string> => {
  const seededUsername = getSeededUsername(projectName)

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

  await page.getByLabel('Username').fill(seededUsername)
  await page.getByLabel('Password').fill(SEEDED_PASSWORD)
  
  // Wait for the button to be stable before clicking
  const loginButton = page.getByRole('button', { name: 'Login' })
  await expect(loginButton).toBeVisible({ timeout: 10_000 })
  await expect(loginButton).toBeEnabled({ timeout: 10_000 })
  
  // Click with a longer timeout and wait for navigation
  await loginButton.click({ timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 })

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(seededUsername)).toBeVisible({ timeout: 10_000 })

  return seededUsername
}

export const clearAuthState = async (page: Page): Promise<void> => {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}
