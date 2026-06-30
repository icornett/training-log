import { expect, type Page } from '@playwright/test'

export const REAL_DB_AUTH_FILE = 'tests/e2e/.auth/real-db-user.json'

const SEEDED_PASSWORD = 'playwright-pass-123'
const LEGACY_SEEDED_USERNAME = 'Playwright User'

const SEEDED_USERNAMES_BY_PROJECT: Record<string, string> = {
  'ios-safari': 'Playwright User iOS',
  'android-chrome': 'Playwright User Android',
  chromium: 'Playwright User Chromium',
  safari: 'Playwright User Safari',
}

export const getSeededUsername = (projectName?: string): string => {
  if (!projectName) {
    return SEEDED_USERNAMES_BY_PROJECT['ios-safari']
  }

  return SEEDED_USERNAMES_BY_PROJECT[projectName] ?? SEEDED_USERNAMES_BY_PROJECT['ios-safari']
}

export const loginAsSeededUser = async (page: Page, projectName?: string): Promise<string> => {
  const preferredUsername = getSeededUsername(projectName)
  const candidateUsernames = [preferredUsername, LEGACY_SEEDED_USERNAME].filter(
    (username, index, arr) => arr.indexOf(username) === index,
  )

  for (const seededUsername of candidateUsernames) {
    try {
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

      await page.getByLabel('Username').fill(seededUsername)
      await page.getByLabel('Password').fill(SEEDED_PASSWORD)

      const loginButton = page.getByRole('button', { name: 'Login' })
      await expect(loginButton).toBeVisible({ timeout: 10_000 })
      await expect(loginButton).toBeEnabled({ timeout: 10_000 })
      await loginButton.click({ timeout: 15_000 })

      // Avoid relying on `networkidle`: the app may continue background sync/retry traffic.
      await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText(seededUsername)).toBeVisible({ timeout: 10_000 })

      return seededUsername
    } catch {
      await page.context().clearCookies()
      await page.goto('/login')
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
    }
  }

  throw new Error(`Unable to authenticate seeded user for project '${projectName ?? 'unknown'}'`)
}

export const clearAuthState = async (page: Page): Promise<void> => {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}
