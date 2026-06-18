import { expect, test, type Page } from '@playwright/test'

type StrengthExercise = {
  description: string
  sets: string
  reps: string
  weight: string
}

const makeUsername = (projectName: string): string => {
  const projectSlug = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `sqlite-${projectSlug}-${String(Date.now()).slice(-4)}`
}

const buildStrengthExercises = (totalExercises: number): StrengthExercise[] =>
  Array.from({ length: totalExercises }, (_, index) => ({
    description: `SQLite Exercise ${index + 1}`,
    sets: String(3 + index),
    reps: String(12 + index),
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

const expectWorkoutsLanding = async (page: Page, action: string): Promise<void> => {
  const workoutsHeading = page.getByRole('heading', { name: 'Workouts' })

  try {
    await expect.poll(() => page.url(), { timeout: 12_000 }).toContain('/training_log/')
  } catch {
    const inlineError = (await page.locator('.error-text').first().textContent())?.trim() ?? 'none'
    throw new Error(
      `${action} did not navigate to /training_log/. url=${page.url()} inlineError=${inlineError}`,
    )
  }

  await expect(workoutsHeading).toBeVisible({ timeout: 12_000 })
}

const cleanupUserIfPresent = async (
  page: Page,
  username: string,
  password: string,
): Promise<void> => {
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

test('sqlite user can complete a full workflow', async ({ page }, testInfo) => {
  const username = makeUsername(testInfo.project.name)
  const password = 'sqlite-password-123'
  const exercises = buildStrengthExercises(3)
  const workoutName = 'SQLite Workout'

  try {
    // Signup
    await page.goto('/signup')

    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel(/I agree to the privacy notice/i).check()
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expectWorkoutsLanding(page, 'Signup')
    await expect(page.getByText(username)).toBeVisible()

    // Create workout
    await page.getByRole('link', { name: 'Log New Workout' }).click()
    await page.getByLabel('Workout Name').fill(workoutName)
    await page.getByLabel('Workout Date').fill('2026-06-15')
    await page.getByRole('button', { name: 'Continue to Exercises' }).click()

    await expect(page.getByRole('heading', { name: workoutName })).toBeVisible()
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

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

    // Login and verify persistence
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Login' }).click()

    await expectWorkoutsLanding(page, 'Login')
    await page.getByRole('listitem').filter({ hasText: workoutName }).first().getByRole('link', { name: 'View Workout' }).click()

    await expect(page.getByRole('heading', { name: workoutName })).toBeVisible()
    for (const exercise of exercises) {
      await expect(page.getByRole('listitem').filter({ hasText: exercise.description })).toBeVisible()
    }
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
    await page.getByLabel(/I agree to the privacy notice/i).check()
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expectWorkoutsLanding(page, 'Signup')

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
    await page.getByRole('textbox', { name: 'Weight' }).fill('225 lbs')
    await page.getByRole('button', { name: 'Add Exercise' }).click()
    await expect(page.getByRole('heading', { name: 'Workout Controls' })).toBeVisible()

    // Navigate back to workouts list
    await page.getByRole('link', { name: 'Workouts', exact: true }).click()

    // Verify workout appears in list
    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Browse Test' }).first()).toBeVisible()
  } finally {
    // Always cleanup
    await cleanupUserIfPresent(page, username, password)
  }
})
