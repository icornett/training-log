import { app, type InvocationContext, type Timer } from '@azure/functions'

import { getRetentionCutoffIso } from '../shared/gdpr.js'
import { purgeExpiredSoftDeletedUsers } from '../shared/gdprPurge.js'
import {
  hardDeleteUserById,
  listSoftDeletedUsersPastRetention,
  logGdprEvent,
} from '../shared/repository.js'

interface PurgeTimerDependencies {
  runPurge: () => Promise<{ purgedCount: number; cutoffIso: string }>
}

export const createPurgeDeletedUsersTimerHandler = (deps: PurgeTimerDependencies) => {
  return async (_timer: Timer, context: InvocationContext): Promise<void> => {
    const result = await deps.runPurge()
    context.log(
      `GDPR purge timer completed. purged=${result.purgedCount} cutoffIso=${result.cutoffIso}`,
    )
  }
}

export const purgeDeletedUsersTimerHandler = createPurgeDeletedUsersTimerHandler({
  runPurge: async () =>
    purgeExpiredSoftDeletedUsers({
      listExpiredUsers: listSoftDeletedUsersPastRetention,
      hardDeleteUser: hardDeleteUserById,
      auditEvent: async (username) => {
        await logGdprEvent('account_purged', username, {
          strategy: 'hard-delete',
          trigger: 'timer',
        })
      },
      getCutoffIso: () => getRetentionCutoffIso(),
    }),
})

app.timer('purge-deleted-users-timer', {
  schedule: process.env.GDPR_PURGE_SCHEDULE ?? '0 0 */12 * * *',
  handler: purgeDeletedUsersTimerHandler,
})
