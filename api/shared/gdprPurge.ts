import { getRetentionCutoffIso } from './gdpr.js'
import {
  hardDeleteUserById,
  listSoftDeletedUsersPastRetention,
  logGdprEvent,
} from './repository.js'

interface PurgeDependencies {
  listExpiredUsers: (cutoffIso: string) => Promise<Array<{ id: number; username: string }>>
  hardDeleteUser: (userId: number) => Promise<void>
  auditEvent: (username: string) => Promise<void>
  getCutoffIso: () => string
}

export interface PurgeResult {
  purgedCount: number
  cutoffIso: string
}

export const purgeExpiredSoftDeletedUsers = async (
  deps: PurgeDependencies = {
    listExpiredUsers: listSoftDeletedUsersPastRetention,
    hardDeleteUser: hardDeleteUserById,
    auditEvent: async (username: string) => {
      await logGdprEvent('account_purged', username, {
        strategy: 'hard-delete',
      })
    },
    getCutoffIso: () => getRetentionCutoffIso(),
  },
): Promise<PurgeResult> => {
  const cutoffIso = deps.getCutoffIso()
  const usersToPurge = await deps.listExpiredUsers(cutoffIso)

  for (const user of usersToPurge) {
    await deps.hardDeleteUser(user.id)
    await deps.auditEvent(user.username)
  }

  return {
    purgedCount: usersToPurge.length,
    cutoffIso,
  }
}
