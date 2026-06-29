import { beforeEach, describe, expect, it, jest } from '@jest/globals'
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
    headers: new Map(),
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
    extractOperationId: async () => null,
    getProcessed: async () => null,
    storeProcessed: async () => undefined,
    validateWorkout: async (): Promise<string | null> => null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

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

  it('returns cached result for duplicate operation id', async () => {
    const createWorkout = jest.fn(async () => 99)
    const validateWorkout = jest.fn(async (): Promise<string | null> => null)
    const getProcessed = jest.fn(async () => ({ id: 77, message: 'cached' }))

    const handler = createWorkoutsHandler({
      ...baseDeps,
      findUserId: async () => 7,
      createWorkout,
      extractOperationId: async () => 'op-1',
      getProcessed,
      validateWorkout,
    })

    const response = await handler(
      makeRequest('POST', {
        body: { name: 'Legs Day', date: '2026-06-01', operationId: 'op-1' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({ id: 77, message: 'cached' })
    expect(createWorkout).not.toHaveBeenCalled()
    expect(validateWorkout).not.toHaveBeenCalled()
    expect(getProcessed).toHaveBeenCalledWith(7, 'op-1')
  })

  it('stores processed operation on successful POST when operation id is provided', async () => {
    const storeProcessed = jest.fn(async () => undefined)

    const handler = createWorkoutsHandler({
      ...baseDeps,
      findUserId: async () => 5,
      createWorkout: async () => 123,
      extractOperationId: async () => 'op-2',
      getProcessed: async () => null,
      storeProcessed,
    })

    const response = await handler(
      makeRequest('POST', {
        body: { name: 'Legs Day', date: '2026-06-01', operationId: 'op-2' },
      }),
    )

    expect(response.status).toBe(201)
    expect(response.jsonBody).toMatchObject({ id: 123 })
    expect(storeProcessed).toHaveBeenCalledWith(
      5,
      'op-2',
      expect.objectContaining({ id: 123, message: expect.any(String) }),
    )
  })

  it('still returns 201 when cache store fails', async () => {
    const storeProcessed = jest.fn(async () => {
      throw new Error('cache unavailable')
    })

    const handler = createWorkoutsHandler({
      ...baseDeps,
      findUserId: async () => 8,
      createWorkout: async () => 456,
      extractOperationId: async () => 'op-3',
      getProcessed: async () => null,
      storeProcessed,
    })

    const response = await handler(
      makeRequest('POST', {
        body: { name: 'Legs Day', date: '2026-06-01', operationId: 'op-3' },
      }),
    )

    expect(response.status).toBe(201)
    expect(response.jsonBody).toMatchObject({ id: 456 })
  })
})
