import { jest } from '@jest/globals'
import type { InvocationContext, Timer } from '@azure/functions'

import { createPurgeDeletedUsersTimerHandler } from './purgeDeletedUsersTimer.js'

describe('createPurgeDeletedUsersTimerHandler', () => {
  it('runs purge and logs summary', async () => {
    const runPurge = jest.fn(async () => ({
      purgedCount: 3,
      cutoffIso: '2026-05-16T00:00:00.000Z',
    }))

    const handler = createPurgeDeletedUsersTimerHandler({ runPurge })
    const log = jest.fn()

    await handler({} as Timer, { log } as unknown as InvocationContext)

    expect(runPurge).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(
      'GDPR purge timer completed. purged=3 cutoffIso=2026-05-16T00:00:00.000Z',
    )
  })
})
