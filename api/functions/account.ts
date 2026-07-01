import { app, type HttpRequest } from '@azure/functions'

import { clearSessionCookie, getSessionUser } from '../shared/auth.js'
import { json, parseJsonBody } from '../shared/http.js'
import {
  getUserFavoriteTeam,
  logGdprEvent,
  softDeleteUserByUsername,
  updateUserFavoriteTeam,
  VALID_TEAM_KEYS,
} from '../shared/repository.js'
import { requireExistingUser } from '../shared/validation.js'

interface AccountDependencies {
  getUser: typeof getSessionUser
  requireUser: (username: string) => Promise<boolean>
  deleteUser: (username: string) => Promise<void>
  auditEvent: (username: string) => Promise<void>
  clearCookie: () => string
  getFavoriteTeam: (username: string) => Promise<string | null>
  setFavoriteTeam: (username: string, teamKey: string) => Promise<void>
}

const DEFAULT_FAVORITE_TEAM_KEY = 'nfl:seahawks'

export const createAccountHandler = (dependencies: AccountDependencies) => {
  return async (request: HttpRequest) => {
    const user = dependencies.getUser(request)
    if (!user || !(await dependencies.requireUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    if (request.method === 'GET') {
      const favoriteTeamKey = (await dependencies.getFavoriteTeam(user.username)) ?? DEFAULT_FAVORITE_TEAM_KEY
      return json(200, { username: user.username, favoriteTeamKey })
    }

    if (request.method === 'PUT') {
      const body = await parseJsonBody<{ teamKey?: unknown }>(request)
      const teamKey = body?.teamKey
      if (typeof teamKey !== 'string' || !VALID_TEAM_KEYS.has(teamKey)) {
        return json(400, { error: 'Invalid team key.' })
      }
      await dependencies.setFavoriteTeam(user.username, teamKey)
      return json(200, { favoriteTeamKey: teamKey })
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
  getFavoriteTeam: getUserFavoriteTeam,
  setFavoriteTeam: updateUserFavoriteTeam,
})

/* istanbul ignore next -- runtime registration is environment-gated and not exercised in unit tests */
// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('account', {
    methods: ['GET', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    route: 'account',
    handler: accountHandler,
  })
}
