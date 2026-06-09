import type { HttpRequest } from '@azure/functions'

import { createWorkoutsHandler } from './workouts.js'
import type { WorkoutRow } from '../shared/types.js'

const makeRequest = (
  method: string,
  options: { query?: Record<string, string>; body?: Record<string, unknown> } = {},
): HttpRequest =>
  ({
    method,
    query: { get: (key: string) => options.query?.[key] ?? null } as URLSearchParams,
    json: async () => options.body ?? {},
  }) as unknown as HttpRequest

describe('createWorkoutsHandler', () => {
  const sampleRow: WorkoutRow = {
    id: 1,
    name: 'Legs Day',
    date: '2026-06-01',
    username: 'testuser',
    numSets: 0,
    numReps: 0,
    weightDescription: 'bodyweight',
  }

  const baseDeps = {
    getUser: () => ({ username: 'testuser' }),
    requireUser: async () => true,
    countWorkouts: async () => 0,
    listWorkouts: async (): Promise<WorkoutRow[]> => [],
    findUserId: async () => 1,
    createWorkout: async () => 42,
    validateWorkout: async (): Promise<string | null> => null,
  }

  it('returns 401 when session user is not present', async () => {
    const handler = createWorkoutsHandler({ ...baseDeps, getUser: () => null })
    const response = await handler(makeRequest('GET'))
    expect(response.status).toBe(401)
  })

  it('returns 401 when user is not found in the database', async () => {
    const handler = createWorkoutsHandler({ ...baseDeps, requireUser: async () => false })
    const response = await handler(makeRequest('GET'))
    expect(response.status).toBe(401)
  })

  it('returns 400 for non-numeric page query parameter', async () => {
    const handler = createWorkoutsHandler(baseDeps)
    const response = await handler(makeRequest('GET', { query: { page: 'abc' } }))
    expect(response.status).toBe(400)
  })

  it('returns paginated workout list for GET requests', async () => {
    const handler = createWorkoutsHandler({
      ...baseDeps,
      countWorkouts: async () => 1,
      listWorkouts: async () => [sampleRow],
    })
    const response = await handler(makeRequest('GET', { query: { page: '1' } }))
    expect(response.status).toBe(200)
    expect(response.jsonBody).toMatchObject({ items: [sampleRow], totalPages: 1, page: 1 })
  })

  it('returns 422 when workout validation fails', async () => {
    const handler = createWorkoutsHandler({
      ...baseDeps,
      validateWorkout: async () => 'Invalid workout entry. Name too short.',
    })
    const response = await handler(makeRequest('POST', { body: { name: 'Hi', date: '2026-06-01' } }))
    expect(response.status).toBe(422)
    expect(response.jsonBody).toMatchObject({ error: 'Invalid workout entry. Name too short.' })
  })

  it('returns 401 when user id cannot be resolved after validation', async () => {
    const handler = createWorkoutsHandler({ ...baseDeps, findUserId: async () => null })
    const response = await handler(
      makeRequest('POST', { body: { name: 'Legs Day', date: '2026-06-01' } }),
    )
    expect(response.status).toBe(401)
  })

  it('returns 201 with the new workout id for valid POST', async () => {
    const handler = createWorkoutsHandler({ ...baseDeps, createWorkout: async () => 99 })
    const response = await handler(
      makeRequest('POST', { body: { name: 'Legs Day', date: '2026-06-01' } }),
    )
    expect(response.status).toBe(201)
    expect(response.jsonBody).toMatchObject({ id: 99 })
  })
})
