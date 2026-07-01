import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { json, parseJsonBody } from '../shared/http.js'
import {
  addWorkoutWithExercise,
  findUserIdByUsername,
  getWorkoutWithExercisesForUser,
} from '../shared/repository.js'
import type { SessionUser, WorkoutDetails } from '../shared/types.js'
import {
  invalidExerciseEditMessage,
  invalidWorkoutMessage,
  requireExistingUser,
} from '../shared/validation.js'
import { kphToMph } from '../shared/speed.js'

interface WorkoutWithExerciseBody {
  name?: string
  date?: string
  exercise?: {
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
  }
}

interface ExerciseData {
  description: string
  numSets: number | null
  numReps: number | null
  weightDescription: string | null
  exerciseType: string
  durationMinutes: number | null
  speedMph: number | null
  notes: string | null
}

interface WorkoutWithExerciseDependencies {
  getUser: (request: HttpRequest) => SessionUser | null
  requireUser: (username: string) => Promise<boolean>
  findUserId: (username: string) => Promise<number | null>
  validateWorkout: (
    name: string,
    date: string,
    username: string,
    workoutId: number | null,
  ) => Promise<string | null>
  validateFirstExercise: (description: string, weights: string, exerciseType: string) => string | null
  createBoth: (
    userId: number,
    name: string,
    date: string,
    exercise: ExerciseData,
  ) => Promise<{ workoutId: number; exerciseId: number }>
  getWorkout: (workoutId: number, username: string) => Promise<WorkoutDetails | null>
}

export const createWorkoutWithExerciseHandler = (deps: WorkoutWithExerciseDependencies) => {
  return async (request: HttpRequest) => {
    const user = deps.getUser(request)
    if (!user || !(await deps.requireUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const body = await parseJsonBody<WorkoutWithExerciseBody>(request)
    const name = body.name?.trim() ?? ''
    const date = body.date ?? ''

    const workoutError = await deps.validateWorkout(name, date, user.username, null)
    if (workoutError) {
      return json(422, { error: workoutError })
    }

    const ex = body.exercise ?? {}
    const description = (ex.description ?? '').replace(/[\p{P}\p{S}]/gu, '')
    const exerciseType = ex.exerciseType ?? 'strength'
    const numSets = ex.numSets !== undefined ? Number(ex.numSets) : null
    const numReps = ex.numReps !== undefined ? Number(ex.numReps) : null
    const weightDescription = ex.weightDescription ? ex.weightDescription.toLowerCase() : null
    const durationMinutes = ex.durationMinutes !== undefined ? Number(ex.durationMinutes) : null
    const speedMphRaw =
      ex.speedMph !== undefined
        ? Number(ex.speedMph)
        : ex.speedKph !== undefined
          ? kphToMph(Number(ex.speedKph))
          : null
    const speedMph = speedMphRaw === null ? null : Number(speedMphRaw.toFixed(2))
    const notes = ex.notes ?? null

    const exerciseError = deps.validateFirstExercise(description, weightDescription ?? '', exerciseType)
    if (exerciseError) {
      return json(422, { error: exerciseError })
    }

    const userId = await deps.findUserId(user.username)
    if (!userId) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const { workoutId } = await deps.createBoth(userId, name, date, {
      description,
      numSets,
      numReps,
      weightDescription,
      exerciseType,
      durationMinutes,
      speedMph,
      notes,
    })

    const workout = await deps.getWorkout(workoutId, user.username)
    if (!workout) {
      return json(500, { error: 'Workout was created but could not be retrieved.' })
    }

    return json(201, workout)
  }
}

export const workoutWithExerciseHandler = createWorkoutWithExerciseHandler({
  getUser: getSessionUser,
  requireUser: requireExistingUser,
  findUserId: findUserIdByUsername,
  validateWorkout: invalidWorkoutMessage,
  validateFirstExercise: invalidExerciseEditMessage,
  createBoth: addWorkoutWithExercise,
  getWorkout: getWorkoutWithExercisesForUser,
})

/* istanbul ignore next -- runtime registration is environment-gated and not exercised in unit tests */
// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('workoutWithFirstExercise', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'workouts/with-first-exercise',
    handler: workoutWithExerciseHandler,
  })
}
