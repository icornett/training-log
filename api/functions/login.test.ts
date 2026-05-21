import type { HttpRequest } from '@azure/functions'

import { createLoginHandler } from './login.js'

describe('createLoginHandler', () => {
  it('returns 422 for invalid credentials', async () => {
    const handler = createLoginHandler({
      buildCookie: () => 'unused',
      validateCredentials: async () => false,
    })

    const request = {
      json: async () => ({ username: 'demo', password: 'wrong-password' }),
    } as HttpRequest

    const response = await handler(request)

    expect(response.status).toBe(422)
    expect(response.jsonBody).toEqual({ error: 'Incorrect login credentials. Please try again.' })
  })

  it('returns a session cookie for valid credentials', async () => {
    const handler = createLoginHandler({
      buildCookie: (username) => `session-for-${username}`,
      validateCredentials: async () => true,
    })

    const request = {
      json: async () => ({ username: 'demo', password: 'valid-password' }),
    } as HttpRequest

    const response = await handler(request)

    expect(response.status).toBe(200)
    expect(response.headers).toEqual({ 'Content-Type': 'application/json', 'Set-Cookie': 'session-for-demo' })
    expect(response.jsonBody).toEqual({ ok: true, username: 'demo' })
  })
})
