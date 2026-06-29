import { expect, test, type Page } from '@playwright/test'

type StrengthExercise = {
  description: string
  sets: string
  reps: string
  weight: string
}

const makeUsername = (projectName: string): string => {
  const projectSlug = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `dedup-${projectSlug}-${String(Date.now()).slice(-4)}`
}

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

test.describe('idempotency and deduplication', () => {

  test('duplicate exercise request with same operationId prevents duplicate exercises', async ({ page }, testInfo) => {
    const username = makeUsername(testInfo.project.name)
    const password = 'dedup-password-123'
    const workoutName = 'Dedup Workout'

    // Signup
    await page.goto('/signup')
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel(/I agree to the privacy notice/i).check()
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expectWorkoutsLanding(page, 'Signup')

    // Create a workout
    await page.getByRole('link', { name: 'Log New Workout' }).click()
    await page.getByLabel('Workout Name').fill(workoutName)
    await page.getByLabel('Workout Date').fill('2026-06-22')
    await page.getByRole('button', { name: 'Continue to Exercises' }).click()

    await expect(page.getByRole('heading', { name: workoutName })).toBeVisible()

    // Add first exercise
    const exercise1 = {
      description: 'Squats',
      sets: '3',
      reps: '10',
      weight: '225 lbs',
    }
    await addStrengthExercise(page, exercise1)
    await expect(page.getByText('Exercise added.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workout Controls' })).toBeVisible()

    // Current UX auto-saves on first exercise and transitions to workout detail.
    // Ensure we're on the persisted workout page before continuing.
    await expect(page.getByRole('heading', { name: workoutName })).toBeVisible()

    // Get initial exercise count
    let exerciseItems = page.getByRole('listitem').filter({ hasText: /strength|cardio/ })
    const initialExerciseCount = await exerciseItems.count()

    // Add another exercise and track the operationId
    let capturedOperationId: string | undefined
    await page.route('**/api/workouts/*/exercises', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>
        if (capturedOperationId === undefined) {
          capturedOperationId = body.operationId as string
        }
      }
      await route.continue()
    })

    const exercise2 = {
      description: 'Bench Press',
      sets: '4',
      reps: '8',
      weight: '185 lbs',
    }
    await addStrengthExercise(page, exercise2)
    await expect(page.getByText('Exercise added.')).toBeVisible()

    // Verify exercise was added
    const benchRow = page.getByRole('listitem').filter({ hasText: 'Bench Press' })
    await expect(benchRow).toHaveCount(1)

    // Get the updated count
    exerciseItems = page.getByRole('listitem').filter({ hasText: /strength|cardio/ })
    const countAfterAdd = await exerciseItems.count()
    expect(countAfterAdd).toBe(initialExerciseCount + 1)

    // Now simulate a retry with the same operationId
    if (capturedOperationId) {
      // Extract workout ID from URL
      const workoutIdMatch = page.url().match(/\/workouts\/(\d+)/)
      if (workoutIdMatch) {
        const workoutId = workoutIdMatch[1]

        // Make the retry request with the same operationId
        const retryResponse = await page.request.post(`/api/workouts/${workoutId}/exercises`, {
          headers: {
            'x-operation-id': capturedOperationId,
            'Content-Type': 'application/json',
          },
          data: {
            operationId: capturedOperationId,
            description: 'Bench Press',
            exerciseType: 'strength',
            numSets: 4,
            numReps: 8,
            weightDescription: '185 lbs',
            notes: '',
          },
        })

        // Verify the retry returns a success status
        expect([200, 201]).toContain(retryResponse.status())

        // Reload and verify no duplicate was created
        await page.reload()
        const benchPressItems = page.getByRole('listitem').filter({ hasText: 'Bench Press' })
        await expect(benchPressItems).toHaveCount(1, { timeout: 5_000 })
      }
    }
  })
})
