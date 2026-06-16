import type { HttpRequest } from '@azure/functions'
import { jest } from '@jest/globals'

import { createPurgeDeletedUsersHandler } from './purgeDeletedUsers.js'

describe('createPurgeDeletedUsersHandler', () => {
  it('returns 403 when token is missing or invalid', async () => {
    const handler = createPurgeDeletedUsersHandler({
      getMaintenanceToken: () => 'expected',
      runPurge: async () => ({ purgedCount: 0, cutoffIso: '2026-05-16T00:00:00.000Z' }),
    })

    const request = {
      headers: new Headers(),
    } as unknown as HttpRequest

    const response = await handler(request)
    expect(response.status).toBe(403)
  })

  it('purges eligible users and returns count', async () => {
    const runPurge = jest.fn(async () => ({
      purgedCount: 2,
      cutoffIso: '2026-05-16T00:00:00.000Z',
    }))

    const handler = createPurgeDeletedUsersHandler({
      getMaintenanceToken: () => 'expected',
      runPurge,
    })

    const request = {
      headers: new Headers({ 'x-gdpr-maintenance-token': 'expected' }),
    } as unknown as HttpRequest

    const response = await handler(request)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toMatchObject({ purgedCount: 2 })
    expect(runPurge).toHaveBeenCalledTimes(1)
  })
})
