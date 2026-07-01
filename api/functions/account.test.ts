import type { HttpRequest } from '@azure/functions'

import { createAccountHandler } from './account.js'

const baseRequest = (method: string, body?: unknown): HttpRequest =>
  ({
    method,
    json: async () => body,
  }) as unknown as HttpRequest

describe('createAccountHandler', () => {
  it('returns current user for GET requests', async () => {
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'cleared',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('GET')
    const response = await handler(request)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({ username: 'demo', favoriteTeamKey: null })
  })

  it('includes the stored favoriteTeamKey in GET response', async () => {
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'cleared',
      getFavoriteTeam: async () => 'nhl:kraken',
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('GET')
    const response = await handler(request)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({ username: 'demo', favoriteTeamKey: 'nhl:kraken' })
  })

  it('updates favorite team key for PUT requests with a valid key', async () => {
    const stored: string[] = []
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'cleared',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async (_username, key) => {
        stored.push(key)
      },
    })

    const request = baseRequest('PUT', { teamKey: 'nfl:seahawks' })
    const response = await handler(request)

    expect(response.status).toBe(200)
    expect(stored).toEqual(['nfl:seahawks'])
  })

  it('returns 400 for PUT with an invalid team key', async () => {
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'cleared',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('PUT', { teamKey: 'nfl:giants' })
    const response = await handler(request)

    expect(response.status).toBe(400)
  })

  it('returns 401 for PUT when not authenticated', async () => {
    const handler = createAccountHandler({
      getUser: () => null,
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'cleared',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('PUT', { teamKey: 'nfl:seahawks' })
    const response = await handler(request)

    expect(response.status).toBe(401)
  })

  it('clears the cookie after account deletion', async () => {
    const deleted: string[] = []
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async (username) => {
        deleted.push(username)
      },
      auditEvent: async () => undefined,
      clearCookie: () => 'training_log_session=;',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('DELETE')
    const response = await handler(request)

    expect(deleted).toEqual(['demo'])
    expect(response.status).toBe(200)
    expect(response.headers).toEqual({
      'Content-Type': 'application/json',
      'Set-Cookie': 'training_log_session=;',
    })
  })

  it('returns 401 when user is not authenticated', async () => {
    const handler = createAccountHandler({
      getUser: () => null,
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => '',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('GET')
    const response = await handler(request)

    expect(response.status).toBe(401)
  })

  it('returns 405 for unsupported methods', async () => {
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'training_log_session=;',
      getFavoriteTeam: async () => null,
      setFavoriteTeam: async () => undefined,
    })

    const request = baseRequest('POST')
    const response = await handler(request)

    expect(response.status).toBe(405)
  })
})
