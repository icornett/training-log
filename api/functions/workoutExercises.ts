import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { extractOperationId } from '../shared/idempotency.js'
import { getNumericPathParam, json, parseJsonBody } from '../shared/http.js'
import {
  addExercise,
  atExerciseLimit,
  workoutExists,
  findUserIdByUsername,
  getProcessedOperation,
  storeProcessedOperation,
} from '../shared/repository.js'
import { invalidNewExerciseMessage, requireExistingUser, requireWorkoutOwnership } from '../shared/validation.js'
import { kphToMph } from '../shared/speed.js'

interface CreateExerciseBody {
  description?: string
  exerciseType?: string
  speedUnit?: 'mph' | 'kmh'
  numSets?: number
  numReps?: number
  weightDescription?: string
  durationMinutes?: number
  speedMph?: number
  speedKph?: number
  notes?: string
  operationId?: string
}

// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('workoutExercises', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'workouts/{workoutId}/exercises',
    handler: async (request: HttpRequest) => {
    const user = getSessionUser(request)
    if (!user || !(await requireExistingUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const workoutId = getNumericPathParam(request, 'workoutId')
    if (!workoutId) {
      return json(400, {
        error:
          'At least one of your url parameters is incorrect. Please ensure numeric values are used for pages and ids.',
      })
    }

    if (!(await workoutExists(workoutId))) {
      return json(404, { error: `Workout #${workoutId} doesn't exist.` })
    }

    const ownership = await requireWorkoutOwnership(workoutId, user.username)
    if (!ownership.ok) {
      return json(403, { error: "You may not add exercises to someone else's workout." })
    }

    if (await atExerciseLimit(workoutId)) {
      return json(422, { error: "You've already logged 10 exercises for this workout." })
    }

    const body = await parseJsonBody<CreateExerciseBody>(request)

    // Extract operationId for deduplication
    const operationId = await extractOperationId(request)

    // Check for duplicate operation if operationId provided
    if (operationId) {
      const userId = await findUserIdByUsername(user.username)
      if (userId) {
        const cached = await getProcessedOperation(userId, operationId)
        if (cached) {
          // Return cached result for duplicate request
          return json(200, cached.body)
        }
      }
    }

    const description = (body.description ?? '').replace(/[\p{P}\p{S}]/gu, '')
    const exerciseType = body.exerciseType ?? 'strength'
    const numSets = body.numSets !== undefined ? Number(body.numSets) : null
    const numReps = body.numReps !== undefined ? Number(body.numReps) : null
    const weightDescription = body.weightDescription ? body.weightDescription.toLowerCase() : null
    const durationMinutes = body.durationMinutes !== undefined ? Number(body.durationMinutes) : null
    const speedMphRaw =
      body.speedMph !== undefined
        ? Number(body.speedMph)
        : body.speedKph !== undefined
          ? kphToMph(Number(body.speedKph))
          : null
    const speedMph = speedMphRaw === null ? null : Number(speedMphRaw.toFixed(2))
    const notes = body.notes ?? null

    const invalidMsg = await invalidNewExerciseMessage(description, weightDescription ?? '', workoutId, exerciseType)
    if (invalidMsg) {
      return json(422, { error: invalidMsg })
    }

    const newExerciseId = await addExercise(
      workoutId,
      description,
      numSets,
      numReps,
      weightDescription,
      exerciseType,
      durationMinutes,
      speedMph,
      notes,
    )

    const result = {
      id: newExerciseId,
      message: `You've successfully added ${description} to your workout.`,
    }

    // Cache the result for future dedup checks
    if (operationId) {
      try {
        const userId = await findUserIdByUsername(user.username)
        if (userId) {
          await storeProcessedOperation(userId, operationId, result)
        }
      } catch {
        // Silently fail if caching fails
      }
    }

    return json(201, result)
  },
  })
}
