import { app, type HttpRequest } from '@azure/functions'

import { clearSessionCookie, getSessionUser } from '../shared/auth.js'
import { json } from '../shared/http.js'
import { logGdprEvent, softDeleteUserByUsername } from '../shared/repository.js'
import { requireExistingUser } from '../shared/validation.js'

interface AccountDependencies {
  getUser: typeof getSessionUser
  requireUser: (username: string) => Promise<boolean>
  deleteUser: (username: string) => Promise<void>
  auditEvent: (username: string) => Promise<void>
  clearCookie: () => string
}

export const createAccountHandler = (dependencies: AccountDependencies) => {
  return async (request: HttpRequest) => {
    const user = dependencies.getUser(request)
    if (!user || !(await dependencies.requireUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    if (request.method === 'GET') {
      return json(200, { username: user.username })
    }

    if (request.method !== 'DELETE') {
      return json(405, { error: 'Method not allowed.' })
    }

    await dependencies.deleteUser(user.username)
    await dependencies.auditEvent(user.username)

    return json(
      200,
      { message: `All account data for '${user.username}' has been deleted.` },
      {
        'Set-Cookie': dependencies.clearCookie(),
      },
    )
  }
}

export const accountHandler = createAccountHandler({
  getUser: getSessionUser,
  requireUser: requireExistingUser,
  deleteUser: softDeleteUserByUsername,
  auditEvent: async (username) => {
    await logGdprEvent('account_deleted', username, {
      strategy: 'soft-delete',
    })
  },
  clearCookie: clearSessionCookie,
})

// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('account', {
    methods: ['GET', 'DELETE'],
    authLevel: 'anonymous',
    route: 'account',
    handler: accountHandler,
  })
}
