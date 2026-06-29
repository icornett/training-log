import { expect, test, type Page } from '@playwright/test'
import { clearAuthState } from './auth'

type StrengthExercise = {
  description: string
  sets: string
  reps: string
  weight: string
}

const makeUsername = (projectName: string): string => {
  const projectSlug = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `e2e-${projectSlug}-${String(Date.now()).slice(-4)}`
}

const buildStrengthExercises = (totalExercises: number): StrengthExercise[] =>
  Array.from({ length: totalExercises }, (_, index) => ({
    description: `Pull Ups ${index + 1}`,
    sets: String(4 + index),
    reps: String(10 + index),
    weight: 'bodyweight',
  }))

const addStrengthExercise = async (page: Page, exercise: StrengthExercise): Promise<void> => {
  await page.getByLabel('Description').fill(exercise.description)
  await page.getByLabel('Exercise Type').selectOption('strength')
  await page.getByLabel('Sets').fill(exercise.sets)
  await page.getByLabel('Reps').fill(exercise.reps)
  await page.getByRole('textbox', { name: 'Weight' }).fill(exercise.weight)
  await page.getByRole('button', { name: 'Add Exercise' }).click()
}

const cleanupUserIfPresent = async (page: Page, username: string, password: string): Promise<void> => {
  try {
    const accountLink = page.getByRole('link', { name: 'Account' })
    if ((await accountLink.count()) === 0) {
      await page.goto('/login')
      await page.getByLabel('Username').fill(username)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Login' }).click()
    }

    await page.getByRole('link', { name: 'Account' }).click()
    const visibleDeleteButton = page.getByRole('button', { name: 'Delete Account' })
    if ((await visibleDeleteButton.count()) > 0) {
      page.on('dialog', (dialog) => {
        void dialog.accept()
      })
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
  const exercises = buildStrengthExercises(3)

  try {
    await clearAuthState(page)
    await page.goto('/signup')

    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel(/I agree to the privacy notice/i).check()
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByText(username)).toBeVisible()

    await page.getByRole('link', { name: 'Log New Workout' }).click()
    await page.getByLabel('Workout Name').fill('Power Day')
    await page.getByLabel('Workout Date').fill('2026-06-05')
    await page.getByRole('button', { name: 'Continue to Exercises' }).click()

    await expect(page.getByRole('heading', { name: 'Power Day' })).toBeVisible()
    await expect(page.getByText('Add your first exercise to save this workout.')).toBeVisible()

    for (const [index, exercise] of exercises.entries()) {
      await addStrengthExercise(page, exercise)
      await expect(page.getByText('Exercise added.')).toBeVisible()
      if (index === 0) {
        await expect(page.getByRole('heading', { name: 'Workout Controls' })).toBeVisible()
      }
      await expect(page.getByRole('listitem').filter({ hasText: exercise.description })).toBeVisible()
    }

    const duplicateExercise = exercises[0]
    await addStrengthExercise(page, duplicateExercise)
    await expect(page.getByText('This exercise already exists for the workout.')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: duplicateExercise.description })).toHaveCount(1)

    const firstExercise = exercises[0]
    const secondExercise = exercises[1]
    const thirdExercise = exercises[2]

    const firstExerciseRow = page.getByRole('listitem').filter({ hasText: firstExercise.description })
    await firstExerciseRow.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByRole('heading', { name: 'Edit Exercise' })).toBeVisible()
    await page.getByLabel('Description').fill('Pull Ups Updated')
    await page.getByRole('button', { name: 'Save Exercise' }).click()

    await expect(page.getByText('Exercise updated.')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Pull Ups Updated' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: secondExercise.description })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: thirdExercise.description })).toBeVisible()

    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByText(username)).toBeVisible()
    await page.getByRole('listitem').filter({ hasText: 'Power Day' }).first().getByRole('link', { name: 'View Workout' }).click()

    await expect(page.getByRole('heading', { name: 'Power Day' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Pull Ups Updated' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: secondExercise.description })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: thirdExercise.description })).toBeVisible()
  } finally {
    await cleanupUserIfPresent(page, username, password)
  }
})