import { expect, test, type Page } from '@playwright/test'

import { setupSqliteMockApi } from './helpers/sqliteMockApi'

declare global {
  interface Window {
    __setTrainingLogOnline?: (value: boolean) => void
  }
}

const installOnlineController = async (page: Page, initialOnline: boolean): Promise<void> => {
  await page.addInitScript((online) => {
    let currentOnline = online
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => currentOnline,
    })
    window.__setTrainingLogOnline = (value: boolean) => {
      currentOnline = value
      window.dispatchEvent(new Event(value ? 'online' : 'offline'))
    }
  }, initialOnline)
}

const seedPendingWorkoutForRetry = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'trainingLog:pendingOperations',
      JSON.stringify([
        {
          operationId: 'op-retry-1',
          deviceId: 'device-1',
          entityType: 'workout',
          action: 'create',
          payload: {
            clientId: 'workout-retry-1',
            name: 'Retry Test',
            date: '2026-06-22',
            exercise: {
              clientId: 'exercise-retry-1',
              description: 'Deadlift',
              exerciseType: 'strength',
              numSets: 4,
              numReps: 5,
              weightDescription: '315 lbs',
              notes: '',
            },
          },
          createdAt: '2026-06-22T12:00:00.000Z',
          retryCount: 0,
        },
      ]),
    )

    localStorage.setItem(
      'trainingLog:workoutSnapshots',
      JSON.stringify([
        {
          id: -501,
          name: 'Retry Test',
          date: '2026-06-22',
          username: 'Playwright User',
          numSets: 4,
          numReps: 5,
          weightDescription: '315 lbs',
          clientId: 'workout-retry-1',
          lastSyncedAt: null,
          pendingState: 'pending',
          exercises: [
            {
              id: -601,
              description: 'Deadlift',
              exerciseType: 'strength',
              numSets: 4,
              numReps: 5,
              weightDescription: '315 lbs',
              durationMinutes: null,
              speedMph: null,
              notes: '',
              clientId: 'exercise-retry-1',
              lastSyncedAt: null,
              pendingState: 'pending',
            },
          ],
        },
      ]),
    )
  })
}

test.describe('mobile retry on transient failures', () => {
  test.beforeEach(async ({ page }) => {
    await setupSqliteMockApi(page)
  })

  test('replays pending sync after an initial 503 transient failure', async ({ page }) => {
    await installOnlineController(page, false)
    await seedPendingWorkoutForRetry(page)

    let requestCount = 0

    await page.route('**/api/workouts/with-first-exercise', async (route) => {
      requestCount += 1
      if (requestCount === 1) {
        // First request fails with 503
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service temporarily unavailable.' }),
        })
      } else {
        // Fall through to setupSqliteMockApi route handler for successful replay.
        await route.fallback()
      }
    })

    await page.goto('/training_log/1/workouts')

    await expect(page.getByText('Offline', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Retry Test' })).toBeVisible()

    // Come back online — triggers flush with retry logic
    await page.evaluate(() => {
      window.__setTrainingLogOnline?.(true)
    })

    // Retry/sync badges are transient, so assert durable outcomes only.
    await expect(page.getByText('Pending sync')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Retry Test' })).toBeVisible()

    await expect(page.getByText(/sync error/i)).toHaveCount(0)
  })

  test('shows Sync error after all retry attempts are exhausted', async ({ page }) => {
    await installOnlineController(page, false)
    await seedPendingWorkoutForRetry(page)

    // All requests fail with 503
    await page.route('**/api/workouts/with-first-exercise', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service temporarily unavailable.' }),
      })
    })

    await page.goto('/training_log/1/workouts')

    await expect(page.getByText('Offline', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Retry Test' })).toBeVisible()

    // Come back online — triggers flush, all retries will fail
    await page.evaluate(() => {
      window.__setTrainingLogOnline?.(true)
    })

    // After all retries exhausted, should show sync error
    await expect(page.getByText(/sync error/i)).toBeVisible({ timeout: 15_000 })

    // Workout should still show as pending (not removed since sync failed)
    await expect(page.getByRole('link', { name: 'Retry Test' })).toBeVisible()
  })

  test('does not retry on 4xx client errors', async ({ page }) => {
    await installOnlineController(page, false)
    await seedPendingWorkoutForRetry(page)

    let replayPostCount = 0

    // 422 Unprocessable Entity — should NOT be retried
    await page.route('**/api/workouts/with-first-exercise', async (route) => {
      replayPostCount += 1
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid workout entry.' }),
      })
    })

    await page.goto('/training_log/1/workouts')
    await expect(page.getByRole('link', { name: 'Retry Test' })).toBeVisible()

    await page.evaluate(() => {
      window.__setTrainingLogOnline?.(true)
    })

    // Should fail fast without retrying
    await expect(page.getByText(/sync error/i)).toBeVisible({ timeout: 10_000 })

    // Two providers can each trigger one flush on reconnect (Auth + Sync).
    // What matters is that we don't spin in retry loops for 4xx responses.
    expect(replayPostCount).toBeLessThanOrEqual(2)
  })
})
