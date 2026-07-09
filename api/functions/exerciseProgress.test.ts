import { describe, expect, it } from '@jest/globals'
import type { HttpRequest } from '@azure/functions'

import { createExerciseProgressHandler } from './exerciseProgress.js'
import type { ExerciseProgressPoint, SessionUser } from '../shared/types.js'

const makeRequest = (query: Record<string, string> = {}): HttpRequest =>
  ({
    method: 'GET',
    query: { get: (key: string) => query[key] ?? null } as URLSearchParams,
    headers: new Map(),
  }) as unknown as HttpRequest

const pointsFixture: ExerciseProgressPoint[] = [
  {
    workoutId: 10,
    workoutDate: '2026-06-01',
    exerciseDescription: 'bench press',
    numSets: 3,
    numReps: 8,
    weightDescription: '135 lbs',
    durationMinutes: null,
    speedMph: null,
  },
  {
    workoutId: 11,
    workoutDate: '2026-06-08',
    exerciseDescription: 'bench press',
    numSets: 3,
    numReps: 9,
    weightDescription: '140 lbs',
    durationMinutes: null,
    speedMph: null,
  },
  {
    workoutId: 12,
    workoutDate: '2026-06-15',
    exerciseDescription: 'bench press',
    numSets: 3,
    numReps: 10,
    weightDescription: '145 lbs',
    durationMinutes: null,
    speedMph: null,
  },
]

describe('createExerciseProgressHandler', () => {
  const baseDeps = {
    getUser: (): SessionUser | null => ({ username: 'testuser' }),
    requireUser: async () => true,
    findUserId: async () => 1,
    getHistory: async (): Promise<ExerciseProgressPoint[]> => pointsFixture,
  }

  it('returns 401 when user is not authenticated', async () => {
    const handler = createExerciseProgressHandler({ ...baseDeps, getUser: () => null })
    const response = await handler(makeRequest({ exercise: 'bench press' }))
    expect(response.status).toBe(401)
  })

  it('returns 401 when user does not exist', async () => {
    const handler = createExerciseProgressHandler({ ...baseDeps, requireUser: async () => false })
    const response = await handler(makeRequest({ exercise: 'bench press' }))
    expect(response.status).toBe(401)
  })

  it('returns 400 when exercise query parameter is missing', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(makeRequest())
    expect(response.status).toBe(400)
    expect(response.jsonBody).toMatchObject({ error: expect.any(String) })
  })

  it('returns 400 for non-numeric limit', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(makeRequest({ exercise: 'bench press', limit: 'abc' }))
    expect(response.status).toBe(400)
    expect(response.jsonBody).toMatchObject({ error: expect.any(String) })
  })

  it('returns 400 for out-of-range limit', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(makeRequest({ exercise: 'bench press', limit: '500' }))
    expect(response.status).toBe(400)
    expect(response.jsonBody).toMatchObject({ error: expect.any(String) })
  })

  it('returns 400 for invalid from date', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(makeRequest({ exercise: 'bench press', from: '2026/06/01' }))
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid to date', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(makeRequest({ exercise: 'bench press', to: 'not-a-date' }))
    expect(response.status).toBe(400)
  })

  it('returns 400 when from is after to', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(
      makeRequest({
        exercise: 'bench press',
        from: '2026-06-20',
        to: '2026-06-01',
      }),
    )
    expect(response.status).toBe(400)
  })

  it('returns empty-state payload when no history exists', async () => {
    const handler = createExerciseProgressHandler({ ...baseDeps, getHistory: async () => [] })
    const response = await handler(makeRequest({ exercise: 'bench press' }))

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({
      exerciseDescription: 'bench press',
      points: [],
      summary: {
        totalPoints: 0,
        firstSeenDate: null,
        lastSeenDate: null,
      },
    })
  })

  it('returns filtered and limited points in stable shape', async () => {
    const handler = createExerciseProgressHandler(baseDeps)
    const response = await handler(
      makeRequest({
        exercise: 'bench press',
        from: '2026-06-02',
        to: '2026-06-30',
        limit: '2',
      }),
    )

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({
      exerciseDescription: 'bench press',
      points: [pointsFixture[1], pointsFixture[2]],
      summary: {
        totalPoints: 2,
        firstSeenDate: '2026-06-08',
        lastSeenDate: '2026-06-15',
      },
    })
  })

  it('uses signed-in user scope for history retrieval', async () => {
    const getHistory = async (): Promise<ExerciseProgressPoint[]> => pointsFixture
    let observedUserId = 0
    let observedExercise = ''
    const handler = createExerciseProgressHandler({
      ...baseDeps,
      findUserId: async () => 42,
      getHistory: async (userId, exercise) => {
        observedUserId = userId
        observedExercise = exercise
        return getHistory()
      },
    })

    const response = await handler(makeRequest({ exercise: 'bench press' }))
    expect(response.status).toBe(200)
    expect(observedUserId).toBe(42)
    expect(observedExercise).toBe('bench press')
  })
})