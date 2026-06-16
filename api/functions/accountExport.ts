import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { toCsv } from '../shared/gdpr.js'
import { json } from '../shared/http.js'
import { getUserDataExportByUsername, logGdprEvent } from '../shared/repository.js'
import type { AccountExportPayload } from '../shared/types.js'
import { requireExistingUser } from '../shared/validation.js'

interface AccountExportDependencies {
  getUser: typeof getSessionUser
  requireUser: (username: string) => Promise<boolean>
  loadExport: (username: string) => Promise<AccountExportPayload | null>
  auditEvent: (username: string, format: 'json' | 'csv', workoutCount: number) => Promise<void>
}

const asCsv = (payload: AccountExportPayload): string => {
  const rows: Array<Array<string | number | null>> = []

  for (const workout of payload.workouts) {
    for (const exercise of workout.exercises) {
      rows.push([
        payload.username,
        workout.id,
        workout.name,
        workout.date,
        exercise.id,
        exercise.description,
        exercise.exerciseType,
        exercise.numSets,
        exercise.numReps,
        exercise.weightDescription,
        exercise.durationMinutes,
        exercise.speedMph,
        exercise.notes,
      ])
    }

    if (workout.exercises.length === 0) {
      rows.push([
        payload.username,
        workout.id,
        workout.name,
        workout.date,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ])
    }
  }

  return toCsv(
    [
      'username',
      'workoutId',
      'workoutName',
      'workoutDate',
      'exerciseId',
      'exerciseDescription',
      'exerciseType',
      'numSets',
      'numReps',
      'weightDescription',
      'durationMinutes',
      'speedMph',
      'notes',
    ],
    rows,
  )
}

export const createAccountExportHandler = (deps: AccountExportDependencies) => {
  return async (request: HttpRequest) => {
    const user = deps.getUser(request)
    if (!user || !(await deps.requireUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const format = request.query.get('format') === 'csv' ? 'csv' : 'json'
    const payload = await deps.loadExport(user.username)
    if (!payload) {
      return json(404, { error: 'No account data available for export.' })
    }

    await deps.auditEvent(user.username, format, payload.workouts.length)

    if (format === 'csv') {
      return {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="training-log-export-${user.username}.csv"`,
        },
        body: asCsv(payload),
      }
    }

    return json(200, payload)
  }
}

export const accountExportHandler = createAccountExportHandler({
  getUser: getSessionUser,
  requireUser: requireExistingUser,
  loadExport: getUserDataExportByUsername,
  auditEvent: async (username, format, workoutCount) => {
    await logGdprEvent('account_exported', username, {
      format,
      workoutCount,
    })
  },
})

// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('account-export', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'account/export',
    handler: accountExportHandler,
  })
}
