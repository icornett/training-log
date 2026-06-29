import { expect, test, type Page } from '@playwright/test'
import { loginAsSeededUser } from './auth'

const openUpperBodyWorkout = async (page: Page): Promise<void> => {
  await page.goto('/training_log/1/workouts')

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Playwright User')).toBeVisible()

  // Wait for workouts list to be fully rendered before interacting with it
  const upperBodyCard = page.getByRole('listitem').filter({ hasText: 'Upper Body' }).first()
  await expect(upperBodyCard).toBeVisible()

  const viewLink = upperBodyCard.getByRole('link', { name: 'View Workout' })
  await expect(viewLink).toBeVisible({ timeout: 30_000 })
  await viewLink.click()
  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible()
}

test('seeded user can browse the real database', async ({ page }) => {
  await loginAsSeededUser(page)

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Playwright User')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Upper Body' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Lower Body' })).toBeVisible({ timeout: 10_000 })

  const upperBodyCard = page.getByRole('listitem').filter({ hasText: 'Upper Body' }).first()
  await upperBodyCard.getByRole('link', { name: 'View Workout' }).click({ timeout: 30_000 })

  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Bench Press')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Treadmill Warmup')).toBeVisible({ timeout: 10_000 })
})

test('seeded user can add an exercise in the real database', async ({ page }) => {
  const uniqueExercise = `Cable Rows ${String(Date.now()).slice(-6)}`

  await loginAsSeededUser(page)
  
  // Navigate and open workout once
  await page.goto('/training_log/1/workouts')
  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  
  const upperBodyCard = page.getByRole('listitem').filter({ hasText: 'Upper Body' }).first()
  await expect(upperBodyCard).toBeVisible({ timeout: 10_000 })
  
  const viewLink = upperBodyCard.getByRole('link', { name: 'View Workout' })
  await viewLink.click({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible({ timeout: 10_000 })

  try {
    // Add exercise while on detail page
    await page.locator('#exercise-description').fill(uniqueExercise)
    await page.locator('#exercise-sets').fill('3')
    await page.locator('#exercise-reps').fill('12')
    await page.locator('#exercise-weight').fill('70 lbs')
    await page.getByRole('button', { name: 'Add Exercise' }).click()

    await expect(page.getByText('Exercise added.')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('listitem').filter({ hasText: uniqueExercise })).toBeVisible({ timeout: 10_000 })
  } finally {
    // Cleanup: delete the exercise while still on the detail page (no second navigation)
    try {
      const rows = page.getByRole('listitem').filter({ hasText: uniqueExercise })
      if ((await rows.count()) > 0) {
        await rows.first().getByRole('button', { name: 'Delete' }).click()
        await expect(page.getByText('Exercise deleted.')).toBeVisible({ timeout: 10_000 })
      }
    } catch (cleanupError) {
      console.log(`Exercise cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`)
    }
  }
})