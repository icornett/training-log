import { expect, test, type Page } from '@playwright/test'

const makeUsername = (projectName: string): string => {
  const projectSlug = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `e2e-${projectSlug}-${String(Date.now()).slice(-4)}`
}

const cleanupUserIfPresent = async (page: Page, username: string, password: string): Promise<void> => {
  try {
    const deleteButton = page.getByRole('button', { name: 'Delete Account' })
    if ((await deleteButton.count()) === 0) {
      await page.goto('/login')
      await page.getByLabel('Username').fill(username)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Login' }).click()
    }

    const visibleDeleteButton = page.getByRole('button', { name: 'Delete Account' })
    if ((await visibleDeleteButton.count()) > 0) {
      await visibleDeleteButton.click()
      await expect(page.getByRole('heading', { name: 'Signup' })).toBeVisible()
    }
  } catch {
    // Best-effort cleanup to avoid leaking test users across runs.
  }
}

test('user can complete a full journey against the real database', async ({ page }, testInfo) => {
  const username = makeUsername(testInfo.project.name)
  const password = 'real-db-password-123'

  try {
    await page.goto('/signup')

    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByText(username)).toBeVisible()

    await page.getByRole('link', { name: 'Log New Workout' }).click()
    await page.getByLabel('Workout Name').fill('Power Day')
    await page.getByLabel('Workout Date').fill('2026-06-05')
    await page.getByRole('button', { name: 'Continue to Exercises' }).click()

    await expect(page.getByRole('heading', { name: 'Power Day' })).toBeVisible()
    await expect(page.getByText('Add your first exercise to save this workout.')).toBeVisible()

    await page.getByLabel('Description').fill('Pull Ups')
    await page.getByLabel('Sets').fill('4')
    await page.getByLabel('Reps').fill('10')
    await page.getByLabel('Weight').fill('bodyweight')
    await page.getByRole('button', { name: 'Add Exercise' }).click()

    await expect(page.getByText('Exercise added.')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Pull Ups' })).toBeVisible()

    const pullUpsRow = page.getByRole('listitem').filter({ hasText: 'Pull Ups' })
    await pullUpsRow.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByRole('heading', { name: 'Edit Exercise' })).toBeVisible()
    await page.getByLabel('Description').fill('Pull Ups Updated')
    await page.getByRole('button', { name: 'Save Exercise' }).click()

    await expect(page.getByText('Exercise updated.')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Pull Ups Updated' })).toBeVisible()

    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByText(username)).toBeVisible()
  } finally {
    await cleanupUserIfPresent(page, username, password)
  }
})