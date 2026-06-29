import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { extractOperationId } from '../shared/idempotency.js'
import { json, parseJsonBody } from '../shared/http.js'
import {
  addWorkout,
  countWorkoutsByUsername,
  findUserIdByUsername,
  listWorkoutsByUsername,
  getProcessedOperation,
  storeProcessedOperation,
} from '../shared/repository.js'
import type { SessionUser, WorkoutRow } from '../shared/types.js'
import { invalidWorkoutMessage, requireExistingUser } from '../shared/validation.js'

interface CreateWorkoutBody {
  name?: string
  date?: string
  operationId?: string
}

interface WorkoutsDependencies {
  getUser: (request: HttpRequest) => SessionUser | null
  requireUser: (username: string) => Promise<boolean>
  countWorkouts: (username: string) => Promise<number>
  listWorkouts: (username: string, offset: number) => Promise<WorkoutRow[]>
  findUserId: (username: string) => Promise<number | null>
  createWorkout: (name: string, date: string, userId: number) => Promise<number>
  extractOperationId: (request: HttpRequest) => Promise<string | null>
  getProcessed: (userId: number, operationId: string) => Promise<Record<string, unknown> | null>
  storeProcessed: (userId: number, operationId: string, body: Record<string, unknown>) => Promise<void>
  validateWorkout: (
    name: string,
    date: string,
    username: string,
    workoutId: number | null,
  ) => Promise<string | null>
}

export const createWorkoutsHandler = (deps: WorkoutsDependencies) => {
  return async (request: HttpRequest) => {
    const user = deps.getUser(request)
    if (!user || !(await deps.requireUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    if (request.method === 'GET') {
      const rawPage = request.query.get('page') ?? '1'
      if (!/^\d+$/.test(rawPage)) {
        return json(400, {
          error:
            'At least one of your url parameters is incorrect. Please ensure numeric values are used for pages and ids.',
        })
      }

      const page = Number(rawPage)
      const totalWorkouts = await deps.countWorkouts(user.username)
      const totalPages = Math.max(1, Math.ceil(totalWorkouts / 10))
      const clampedPage = Math.min(Math.max(page, 1), totalPages)
      const offset = (clampedPage - 1) * 10
      const items = await deps.listWorkouts(user.username, offset)

      return json(200, { items, totalPages, page: clampedPage })
    }

    const body = await parseJsonBody<CreateWorkoutBody>(request)
    const name = body.name?.trim() ?? ''
    const date = body.date ?? ''

    // Extract operationId for deduplication
    const operationId = await deps.extractOperationId(request)

    // Check for duplicate operation if operationId provided
    if (operationId) {
      const userId = await deps.findUserId(user.username)
      if (userId) {
        const cached = await deps.getProcessed(userId, operationId)
        if (cached) {
          // Return cached result for duplicate request
          return json(200, cached)
        }
      }
    }

    const invalidMsg = await deps.validateWorkout(name, date, user.username, null)
    if (invalidMsg) {
      return json(422, { error: invalidMsg })
    }

    const userId = await deps.findUserId(user.username)
    if (!userId) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const newWorkoutId = await deps.createWorkout(name, date, userId)
    const result = {
      id: newWorkoutId,
      message: "You've successfully created a new workout.",
    }

    // Cache the result for future dedup checks
    if (operationId) {
      try {
        await deps.storeProcessed(userId, operationId, result)
      } catch {
        // Silently fail if caching fails
      }
    }

    return json(201, result)
  }
}

export const workoutsHandler = createWorkoutsHandler({
  getUser: getSessionUser,
  requireUser: requireExistingUser,
  countWorkouts: countWorkoutsByUsername,
  listWorkouts: listWorkoutsByUsername,
  findUserId: findUserIdByUsername,
  createWorkout: (name, date, userId) => addWorkout(name, date, 0, 0, 'bodyweight', userId),
  extractOperationId,
  getProcessed: getProcessedOperation,
  storeProcessed: storeProcessedOperation,
  validateWorkout: invalidWorkoutMessage,
})

/* istanbul ignore next -- runtime registration is environment-gated and not exercised in unit tests */
// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('workouts', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'workouts',
    handler: workoutsHandler,
  })
}

