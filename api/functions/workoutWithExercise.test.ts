import type { HttpRequest } from '@azure/functions'
import { jest } from '@jest/globals'

import { createWorkoutWithExerciseHandler } from './workoutWithExercise.js'
import type { WorkoutDetails } from '../shared/types.js'

const makeRequest = (body: Record<string, unknown>): HttpRequest =>
  ({
    method: 'POST',
    json: async () => body,
  }) as unknown as HttpRequest

const workoutFixture: WorkoutDetails = {
  id: 1,
  name: 'Legs Day',
  date: '2026-06-01',
  username: 'testuser',
  numSets: 0,
  numReps: 0,
  weightDescription: 'bodyweight',
  exercises: [
    {
      id: 10,
      description: 'Squats',
      numSets: 3,
      numReps: 10,
      weightDescription: 'bodyweight',
      exerciseType: 'strength',
      durationMinutes: null,
      speedMph: null,
      notes: null,
    },
  ],
}

describe('createWorkoutWithExerciseHandler', () => {
  const baseDeps = {
    getUser: () => ({ username: 'testuser' }),
    requireUser: async () => true,
    findUserId: async () => 1,
    validateWorkout: async (): Promise<string | null> => null,
    validateFirstExercise: (): string | null => null,
    createBoth: async () => ({ workoutId: 1, exerciseId: 10 }),
    getWorkout: async () => workoutFixture,
  }

  it('returns 401 when user is not authenticated', async () => {
    const handler = createWorkoutWithExerciseHandler({ ...baseDeps, getUser: () => null })
    const response = await handler(makeRequest({}))
    expect(response.status).toBe(401)
  })

  it('returns 401 when user is not found in the database', async () => {
    const handler = createWorkoutWithExerciseHandler({ ...baseDeps, requireUser: async () => false })
    const response = await handler(makeRequest({}))
    expect(response.status).toBe(401)
  })

  it('returns 422 when workout validation fails', async () => {
    const handler = createWorkoutWithExerciseHandler({
      ...baseDeps,
      validateWorkout: async () => 'Invalid workout entry.',
    })
    const response = await handler(
      makeRequest({
        name: 'Hi',
        date: '2026-06-01',
        exercise: { description: 'Squats', exerciseType: 'strength', numSets: 3, numReps: 10, weightDescription: 'bodyweight' },
      }),
    )
    expect(response.status).toBe(422)
    expect(response.jsonBody).toMatchObject({ error: 'Invalid workout entry.' })
  })

  it('returns 422 when exercise validation fails', async () => {
    const handler = createWorkoutWithExerciseHandler({
      ...baseDeps,
      validateFirstExercise: () => 'Invalid exercise entry.',
    })
    const response = await handler(
      makeRequest({
        name: 'Legs Day',
        date: '2026-06-01',
        exercise: { description: 'Ab', exerciseType: 'strength' },
      }),
    )
    expect(response.status).toBe(422)
    expect(response.jsonBody).toMatchObject({ error: 'Invalid exercise entry.' })
  })

  it('returns 201 with full workout details on success', async () => {
    const handler = createWorkoutWithExerciseHandler(baseDeps)
    const response = await handler(
      makeRequest({
        name: 'Legs Day',
        date: '2026-06-01',
        exercise: {
          description: 'Squats',
          exerciseType: 'strength',
          numSets: 3,
          numReps: 10,
          weightDescription: 'bodyweight',
        },
      }),
    )
    expect(response.status).toBe(201)
    expect(response.jsonBody).toMatchObject({
      exercises: expect.arrayContaining([expect.objectContaining({ description: 'Squats' })]),
    })
  })

  it('converts cardio speed from km/h to mph before create', async () => {
    const createBoth = jest.fn(async () => ({ workoutId: 1, exerciseId: 10 }))
    const handler = createWorkoutWithExerciseHandler({ ...baseDeps, createBoth })
    const response = await handler(
      makeRequest({
        name: 'Legs Day',
        date: '2026-06-01',
        exercise: {
          description: 'Treadmill',
          exerciseType: 'cardio',
          durationMinutes: 20,
          speedKph: 20,
          notes: '',
        },
      }),
    )

    expect(response.status).toBe(201)
    expect(createBoth).toHaveBeenCalledWith(
      1,
      'Legs Day',
      '2026-06-01',
      expect.objectContaining({
        exerciseType: 'cardio',
        speedMph: 12.43,
      }),
    )
  })

  it('returns 500 when workout cannot be fetched after creation', async () => {
    const handler = createWorkoutWithExerciseHandler({ ...baseDeps, getWorkout: async () => null })
    const response = await handler(
      makeRequest({
        name: 'Legs Day',
        date: '2026-06-01',
        exercise: { description: 'Squats', exerciseType: 'strength', numSets: 3, numReps: 10, weightDescription: 'bodyweight' },
      }),
    )
    expect(response.status).toBe(500)
  })

  it('returns 401 when user id cannot be resolved after validation', async () => {
    const handler = createWorkoutWithExerciseHandler({ ...baseDeps, findUserId: async () => null })
    const response = await handler(
      makeRequest({
        name: 'Legs Day',
        date: '2026-06-01',
        exercise: { description: 'Squats', exerciseType: 'strength', numSets: 3, numReps: 10, weightDescription: 'bodyweight' },
      }),
    )
    expect(response.status).toBe(401)
  })
})
