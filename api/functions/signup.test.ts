import type { HttpRequest } from '@azure/functions'
import { jest } from '@jest/globals'

import { createSignupHandler } from './signup.js'

describe('createSignupHandler', () => {
  it('returns 422 when consent is not accepted', async () => {
    const handler = createSignupHandler({
      addUser: async () => undefined,
      validateNewUser: async () => true,
      buildCookie: () => 'unused',
      auditEvent: async () => undefined,
    })

    const request = {
      json: async () => ({ username: 'demo', password: 'super-secure-password' }),
      headers: new Headers(),
    } as unknown as HttpRequest

    const response = await handler(request)
    expect(response.status).toBe(422)
  })

  it('returns 422 when username/password are invalid', async () => {
    const handler = createSignupHandler({
      addUser: async () => undefined,
      validateNewUser: async () => false,
      buildCookie: () => 'unused',
      auditEvent: async () => undefined,
    })

    const request = {
      json: async () => ({
        username: 'demo',
        password: 'short',
        gdprConsentAccepted: true,
      }),
      headers: new Headers(),
    } as unknown as HttpRequest

    const response = await handler(request)
    expect(response.status).toBe(422)
  })

  it('creates user and returns session cookie for valid payload', async () => {
    const addUser = jest.fn(async () => undefined)
    const auditEvent = jest.fn(async () => undefined)
    const handler = createSignupHandler({
      addUser,
      validateNewUser: async () => true,
      buildCookie: (username) => `session-for-${username}`,
      auditEvent,
    })

    const request = {
      json: async () => ({
        username: 'demo',
        password: 'super-secure-password',
        gdprConsentAccepted: true,
      }),
      headers: new Headers({
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'jest',
      }),
    } as unknown as HttpRequest

    const response = await handler(request)

    expect(response.status).toBe(201)
    expect(response.headers).toEqual({
      'Content-Type': 'application/json',
      'Set-Cookie': 'session-for-demo',
    })
    expect(addUser).toHaveBeenCalledWith(
      'demo',
      'super-secure-password',
      expect.objectContaining({
        consentVersion: 'v1',
        consentIp: '127.0.0.1',
        consentUserAgent: 'jest',
      }),
    )
    expect(auditEvent).toHaveBeenCalledWith('demo')
  })
})
