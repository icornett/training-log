import type { HttpRequest } from '@azure/functions'

import { createAccountHandler } from './account.js'

describe('createAccountHandler', () => {
  it('returns current user for GET requests', async () => {
    const handler = createAccountHandler({
      getUser: () => ({ username: 'demo' }),
      requireUser: async () => true,
      deleteUser: async () => undefined,
      auditEvent: async () => undefined,
      clearCookie: () => 'cleared',
    })

    const request = { method: 'GET' } as HttpRequest
    const response = await handler(request)

    expect(response.status).toBe(200)
    expect(response.jsonBody).toEqual({ username: 'demo' })
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
    })

    const request = { method: 'DELETE' } as HttpRequest
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
    })

    const request = { method: 'GET' } as HttpRequest
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
    })

    const request = { method: 'POST' } as HttpRequest
    const response = await handler(request)

    expect(response.status).toBe(405)
  })
})
