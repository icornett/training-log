import { expect, test, type Page } from '@playwright/test'

const makeUsername = (projectName: string): string => {
  const projectSlug = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `sqlite-${projectSlug}-${String(Date.now()).slice(-4)}`
}

const cleanupUserIfPresent = async (
  page: Page,
  username: string,
  password: string,
): Promise<void> => {
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

test('sqlite user can complete a full workflow', async ({ page }, testInfo) => {
  const username = makeUsername(testInfo.project.name)
  const password = 'sqlite-password-123'

  try {
    // Signup
    await page.goto('/signup')

    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByText(username)).toBeVisible()

    // Create workout
    await page.getByRole('link', { name: 'Log New Workout' }).click()
    await page.getByLabel('Workout Name').fill('SQLite Test Workout')
    await page.getByLabel('Workout Date').fill('2026-06-15')
    await page.getByRole('button', { name: 'Continue to Exercises' }).click()

    await expect(page.getByRole('heading', { name: 'SQLite Test Workout' })).toBeVisible()
    await expect(page.getByText('Add your first exercise to save this workout.')).toBeVisible()

    // Add exercise to pending workout
    await page.getByLabel('Description').fill('Push Ups')
    await page.getByLabel('Exercise Type').selectOption('strength')
    await page.getByLabel('Sets').fill('3')
    await page.getByLabel('Reps').fill('15')
    await page.getByLabel('Weight').fill('bodyweight')
    await page.getByRole('button', { name: 'Add Exercise' }).click()

    // Should navigate to saved workout after adding first exercise
    await expect(page.getByRole('heading', { name: 'SQLite Test Workout' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Push Ups' })).toBeVisible()

    // Add second exercise
    await page.getByLabel('Description').fill('Squats')
    await page.getByLabel('Exercise Type').selectOption('strength')
    await page.getByLabel('Sets').fill('4')
    await page.getByLabel('Reps').fill('20')
    await page.getByLabel('Weight').fill('bodyweight')
    await page.getByRole('button', { name: 'Add Exercise' }).click()

    await expect(page.getByText('Exercise added.')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Squats' })).toBeVisible()

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

    // Login and verify persistence
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await page
      .getByRole('row')
      .filter({ hasText: 'SQLite Test Workout' })
      .getByRole('link', { name: 'View Workout' })
      .click()

    await expect(page.getByRole('heading', { name: 'SQLite Test Workout' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Push Ups' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Squats' })).toBeVisible()
  } finally {
    // Always cleanup
    await cleanupUserIfPresent(page, username, password)
  }
})

test('sqlite user can browse workouts', async ({ page }, testInfo) => {
  const username = makeUsername(testInfo.project.name)
  const password = 'sqlite-password-123'

  try {
    // Signup and create workout
    await page.goto('/signup')
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()

    // Create a workout
    await page.getByRole('link', { name: 'Log New Workout' }).click()
    await page.getByLabel('Workout Name').fill('Browse Test')
    await page.getByLabel('Workout Date').fill('2026-06-14')
    await page.getByRole('button', { name: 'Continue to Exercises' }).click()

    // Add an exercise
    await page.getByLabel('Description').fill('Bench Press')
    await page.getByLabel('Exercise Type').selectOption('strength')
    await page.getByLabel('Sets').fill('5')
    await page.getByLabel('Reps').fill('5')
    await page.getByLabel('Weight').fill('225 lbs')
    await page.getByRole('button', { name: 'Add Exercise' }).click()

    // Navigate back to workouts list
    await page.getByRole('link', { name: 'Workouts' }).click()

    // Verify workout appears in list
    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Browse Test' })).toBeVisible()
  } finally {
    // Always cleanup
    await cleanupUserIfPresent(page, username, password)
  }
})
