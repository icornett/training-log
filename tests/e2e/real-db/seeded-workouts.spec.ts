import { expect, test, type Page } from '@playwright/test'

const openUpperBodyWorkout = async (page: Page): Promise<void> => {
  await page.goto('/training_log/1/workouts')

  const loginHeading = page.getByRole('heading', { name: 'Login' })
  if ((await loginHeading.count()) > 0) {
    await page.getByLabel('Username').fill('Playwright User')
    await page.getByLabel('Password').fill('playwright-pass-123')
    await page.getByRole('button', { name: 'Login' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()

  const upperBodyRow = page.getByRole('row').filter({ hasText: 'Upper Body' })
  await upperBodyRow.getByRole('link', { name: 'View Workout' }).click()
  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible()
}

const cleanupExerciseIfPresent = async (
  page: Page,
  description: string,
): Promise<void> => {
  try {
    await openUpperBodyWorkout(page)
    const rows = page.getByRole('listitem').filter({ hasText: description })
    if ((await rows.count()) > 0) {
      await rows.first().getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByText('Exercise deleted.')).toBeVisible()
    }
  } catch {
    // Best-effort cleanup to avoid leaking seeded state across runs.
  }
}

test('seeded user can browse the real database', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Username').fill('Playwright User')
  await page.getByLabel('Password').fill('playwright-pass-123')
  await page.getByRole('button', { name: 'Login' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Playwright User')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Upper Body' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Lower Body' })).toBeVisible()

  const upperBodyRow = page.getByRole('row').filter({ hasText: 'Upper Body' })
  await upperBodyRow.getByRole('link', { name: 'View Workout' }).click()

  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible()
  await expect(page.getByText('Bench Press')).toBeVisible()
  await expect(page.getByText('Treadmill Warmup')).toBeVisible()
})

test('seeded user can add an exercise in the real database', async ({ page }) => {
  const uniqueExercise = `Cable Rows ${String(Date.now()).slice(-6)}`

  try {
    await openUpperBodyWorkout(page)

    await page.locator('#exercise-description').fill(uniqueExercise)
    await page.locator('#exercise-sets').fill('3')
    await page.locator('#exercise-reps').fill('12')
    await page.locator('#exercise-weight').fill('70 lbs')
    await page.getByRole('button', { name: 'Add Exercise' }).click()

    await expect(page.getByText('Exercise added.')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: uniqueExercise })).toBeVisible()
  } finally {
    await cleanupExerciseIfPresent(page, uniqueExercise)
  }
})