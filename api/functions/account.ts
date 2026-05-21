import { app, type HttpRequest } from '@azure/functions'

import { clearSessionCookie, getSessionUser } from '../shared/auth.js'
import { json } from '../shared/http.js'
import { deleteUserByUsername } from '../shared/repository.js'
import { requireExistingUser } from '../shared/validation.js'

interface AccountDependencies {
  getUser: typeof getSessionUser
  requireUser: (username: string) => Promise<boolean>
  deleteUser: (username: string) => Promise<void>
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

    await dependencies.deleteUser(user.username)

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
  deleteUser: deleteUserByUsername,
  clearCookie: clearSessionCookie,
})

app.http('account', {
  methods: ['GET', 'DELETE'],
  authLevel: 'anonymous',
  route: 'account',
  handler: accountHandler,
})
