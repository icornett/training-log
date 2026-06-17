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

const seedPendingWorkout = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const workoutName = 'Offline Legs'

    localStorage.setItem(
      'trainingLog:pendingOperations',
      JSON.stringify([
        {
          operationId: 'op-1',
          deviceId: 'device-1',
          entityType: 'workout',
          action: 'create',
          payload: {
            clientId: 'workout-local-1',
            name: workoutName,
            date: '2026-06-16',
            exercise: {
              clientId: 'exercise-local-1',
              description: 'Split Squat',
              exerciseType: 'strength',
              numSets: 3,
              numReps: 12,
              weightDescription: 'bodyweight',
              notes: '',
            },
          },
          createdAt: '2026-06-16T12:00:00.000Z',
          retryCount: 0,
        },
      ]),
    )

    localStorage.setItem(
      'trainingLog:workoutSnapshots',
      JSON.stringify([
        {
          id: -101,
          name: workoutName,
          date: '2026-06-16',
          username: 'Playwright User',
          numSets: 3,
          numReps: 12,
          weightDescription: 'bodyweight',
          clientId: 'workout-local-1',
          lastSyncedAt: null,
          pendingState: 'pending',
          exercises: [
            {
              id: -201,
              description: 'Split Squat',
              exerciseType: 'strength',
              numSets: 3,
              numReps: 12,
              weightDescription: 'bodyweight',
              durationMinutes: null,
              speedMph: null,
              notes: '',
              clientId: 'exercise-local-1',
              lastSyncedAt: null,
              pendingState: 'pending',
            },
          ],
        },
      ]),
    )
  })
}

const seedConflictWorkout = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'trainingLog:pendingOperations',
      JSON.stringify([
        {
          operationId: 'op-2',
          deviceId: 'device-1',
          entityType: 'exercise',
          action: 'update',
          payload: {
            workoutId: 101,
            exerciseId: 1001,
            description: 'Bench Press',
            exerciseType: 'strength',
            numSets: 3,
            numReps: 8,
            weightDescription: '140 lbs',
            notes: '',
          },
          createdAt: '2026-06-16T12:10:00.000Z',
          retryCount: 0,
        },
      ]),
    )

    localStorage.setItem(
      'trainingLog:workoutSnapshots',
      JSON.stringify([
        {
          id: 101,
          name: 'Upper Body',
          date: '2026-06-01',
          username: 'Playwright User',
          numSets: 3,
          numReps: 8,
          weightDescription: '140 lbs',
          lastSyncedAt: null,
          pendingState: 'pending',
          exercises: [
            {
              id: 1001,
              description: 'Bench Press',
              exerciseType: 'strength',
              numSets: 3,
              numReps: 8,
              weightDescription: '140 lbs',
              durationMinutes: null,
              speedMph: null,
              notes: '',
              lastSyncedAt: null,
              pendingState: 'pending',
            },
          ],
        },
      ]),
    )
  })
}

test.describe('mobile offline sync', () => {
  test.beforeEach(async ({ page }) => {
    await setupSqliteMockApi(page)
  })

  test('mobile users can see and replay an offline workout after reconnecting', async ({ page }) => {
    await installOnlineController(page, false)
    await seedPendingWorkout(page)

    await page.goto('/training_log/1/workouts')

    await expect(page.getByText('Offline', { exact: true })).toBeVisible()
    await expect(page.getByText('1 pending sync')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Offline Legs' })).toBeVisible()
    await expect(page.getByText('Pending sync').first()).toBeVisible()

    await page.evaluate(() => {
      window.__setTrainingLogOnline?.(true)
    })

    await expect(page.getByText('1 pending sync')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Offline Legs' })).toBeVisible()
    await expect(page.getByText('Pending sync')).toHaveCount(0)
  })

  test('mobile users see a sync issue when reconnect replay hits a conflict', async ({ page }) => {
    await installOnlineController(page, false)
    await seedConflictWorkout(page)
    await page.route('**/api/workouts/101/exercises/1001', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server version changed.' }),
      })
    })

    await page.goto('/training_log/1/workouts/101')

    await expect(page.getByText('Pending sync').first()).toBeVisible()

    await page.evaluate(() => {
      window.__setTrainingLogOnline?.(true)
    })

    await expect(page.getByText('Sync issue')).toBeVisible()
    await expect(page.getByText('Sync conflict').first()).toBeVisible()
  })
})