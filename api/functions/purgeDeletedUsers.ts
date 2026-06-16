import { app, type HttpRequest } from '@azure/functions'

import { getRetentionCutoffIso } from '../shared/gdpr.js'
import { purgeExpiredSoftDeletedUsers } from '../shared/gdprPurge.js'
import { json } from '../shared/http.js'
import {
  hardDeleteUserById,
  listSoftDeletedUsersPastRetention,
  logGdprEvent,
} from '../shared/repository.js'

interface PurgeDependencies {
  getMaintenanceToken: () => string | undefined
  runPurge: () => Promise<{ purgedCount: number; cutoffIso: string }>
}

export const createPurgeDeletedUsersHandler = (deps: PurgeDependencies) => {
  return async (request: HttpRequest) => {
    const expectedToken = deps.getMaintenanceToken()
    const providedToken = request.headers.get('x-gdpr-maintenance-token')

    if (!expectedToken || providedToken !== expectedToken) {
      return json(403, { error: 'Forbidden.' })
    }

    const result = await deps.runPurge()

    return json(200, {
      purgedCount: result.purgedCount,
      cutoffIso: result.cutoffIso,
    })
  }
}

export const purgeDeletedUsersHandler = createPurgeDeletedUsersHandler({
  getMaintenanceToken: () => process.env.GDPR_MAINTENANCE_TOKEN,
  runPurge: async () =>
    purgeExpiredSoftDeletedUsers({
      listExpiredUsers: listSoftDeletedUsersPastRetention,
      hardDeleteUser: hardDeleteUserById,
      auditEvent: async (username) => {
        await logGdprEvent('account_purged', username, {
          strategy: 'hard-delete',
        })
      },
      getCutoffIso: () => getRetentionCutoffIso(),
    }),
})

app.http('purge-deleted-users', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/purge-deleted-users',
  handler: purgeDeletedUsersHandler,
})
