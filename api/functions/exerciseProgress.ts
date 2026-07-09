import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { json } from '../shared/http.js'
import { findUserIdByUsername, getExerciseProgressHistory } from '../shared/repository.js'
import type { ExerciseProgressPoint, SessionUser } from '../shared/types.js'
import { requireExistingUser } from '../shared/validation.js'

interface ExerciseProgressDependencies {
  getUser: (request: HttpRequest) => SessionUser | null
  requireUser: (username: string) => Promise<boolean>
  findUserId: (username: string) => Promise<number | null>
  getHistory: (userId: number, exerciseDescription: string) => Promise<ExerciseProgressPoint[]>
}

const INVALID_QUERY_ERROR = 'Invalid request parameters for exercise progress.'
const LIMIT_MIN = 1
const LIMIT_MAX = 365
const LIMIT_DEFAULT = 90

const normalizeExerciseDescription = (description: string): string => {
  return description.trim().toLowerCase().replace(/\s+/g, ' ')
}

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

const parseLimit = (rawLimit: string | null): number | null => {
  if (rawLimit === null) {
    return LIMIT_DEFAULT
  }

  if (!/^\d+$/.test(rawLimit)) {
    return null
  }

  const parsed = Number(rawLimit)
  if (parsed < LIMIT_MIN || parsed > LIMIT_MAX) {
    return null
  }

  return parsed
}

export const createExerciseProgressHandler = (deps: ExerciseProgressDependencies) => {
  return async (request: HttpRequest) => {
    const user = deps.getUser(request)
    if (!user || !(await deps.requireUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const exerciseRaw = request.query.get('exercise') ?? ''
    const exercise = normalizeExerciseDescription(exerciseRaw)
    const limit = parseLimit(request.query.get('limit'))
    const from = request.query.get('from')
    const to = request.query.get('to')

    if (!exercise || exercise.length < 3 || limit === null) {
      return json(400, { error: INVALID_QUERY_ERROR })
    }

    if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) {
      return json(400, { error: INVALID_QUERY_ERROR })
    }

    if (from && to && from > to) {
      return json(400, { error: INVALID_QUERY_ERROR })
    }

    const userId = await deps.findUserId(user.username)
    if (!userId) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const points = await deps.getHistory(userId, exercise)
    const ranged = points.filter((point) => {
      if (from && point.workoutDate < from) {
        return false
      }
      if (to && point.workoutDate > to) {
        return false
      }
      return true
    })
    const limited = ranged.slice(-limit)

    return json(200, {
      exerciseDescription: limited[0]?.exerciseDescription ?? exercise,
      points: limited,
      summary: {
        totalPoints: limited.length,
        firstSeenDate: limited[0]?.workoutDate ?? null,
        lastSeenDate: limited[limited.length - 1]?.workoutDate ?? null,
      },
    })
  }
}

export const exerciseProgressHandler = createExerciseProgressHandler({
  getUser: getSessionUser,
  requireUser: requireExistingUser,
  findUserId: findUserIdByUsername,
  getHistory: getExerciseProgressHistory,
})

/* istanbul ignore next -- runtime registration is environment-gated and not exercised in unit tests */
if (process.env.NODE_ENV !== 'test') {
  app.http('exerciseProgress', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'exercise-progress',
    handler: exerciseProgressHandler,
  })
}