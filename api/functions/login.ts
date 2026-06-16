import { app, type HttpRequest } from '@azure/functions'

import { buildSessionCookie } from '../shared/auth.js'
import { json, parseJsonBody } from '../shared/http.js'
import { validLoginCredentials } from '../shared/repository.js'

interface LoginBody {
  username?: string
  password?: string
}

interface LoginDependencies {
  buildCookie: (username: string) => string
  validateCredentials: (username: string, password: string) => Promise<boolean>
}

export const createLoginHandler = (dependencies: LoginDependencies) => {
  return async (request: HttpRequest) => {
    const body = await parseJsonBody<LoginBody>(request)
    const username = body.username?.trim() ?? ''
    const password = body.password ?? ''

    const valid = await dependencies.validateCredentials(username, password)
    if (!valid) {
      return json(422, { error: 'Incorrect login credentials. Please try again.' })
    }

    return json(
      200,
      { ok: true, username },
      {
        'Set-Cookie': dependencies.buildCookie(username),
      },
    )
  }
}

export const loginHandler = createLoginHandler({
  buildCookie: buildSessionCookie,
  validateCredentials: validLoginCredentials,
})

// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'login',
    handler: loginHandler,
  })
}
