import type { HttpRequest } from '@azure/functions'
import { jest } from '@jest/globals'

import { createAccountExportHandler } from './accountExport.js'

describe('createAccountExportHandler', () => {
  it('returns 401 when unauthenticated', async () => {
    const handler = createAccountExportHandler({
      getUser: () => null,
      requireUser: async () => true,
      loadExport: async () => null,
      auditEvent: async () => undefined,
    })

    const request = {
      method: 'GET',
      query: { get: () => null },
    } as unknown as HttpRequest

    const response = await handler(request)
    expect(response.status).toBe(401)
  })

  it('returns JSON payload by default', async () => {
    const auditEvent = jest.fn(async () => undefined)
    const handler = createAccountExportHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      loadExport: async () => ({
        username: 'demo',
        exportedAt: '2026-06-15T00:00:00.000Z',
        workouts: [],
      }),
      auditEvent,
    })

    const request = {
      method: 'GET',
      query: { get: () => null },
    } as unknown as HttpRequest

    const response = await handler(request)
    expect(response.status).toBe(200)
    expect(response.jsonBody).toMatchObject({ username: 'demo' })
    expect(auditEvent).toHaveBeenCalledWith('demo', 'json', 0)
  })

  it('returns CSV when requested', async () => {
    const handler = createAccountExportHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      loadExport: async () => ({
        username: 'demo',
        exportedAt: '2026-06-15T00:00:00.000Z',
        workouts: [
          {
            id: 1,
            name: 'Legs',
            date: '2026-06-15',
            numSets: 3,
            numReps: 8,
            weightDescription: 'bodyweight',
            exercises: [
              {
                id: 99,
                description: 'Squat',
                exerciseType: 'strength',
                numSets: 3,
                numReps: 8,
                weightDescription: 'bodyweight',
                durationMinutes: null,
                speedMph: null,
                notes: null,
              },
            ],
          },
        ],
      }),
      auditEvent: async () => undefined,
    })

    const request = {
      method: 'GET',
      query: { get: (key: string) => (key === 'format' ? 'csv' : null) },
    } as unknown as HttpRequest

    const response = await handler(request)
    expect(response.status).toBe(200)
    expect(response.headers).toMatchObject({
      'Content-Type': 'text/csv; charset=utf-8',
    })
    expect(response.body).toContain('workoutName')
    expect(response.body).toContain('Squat')
  })
})
