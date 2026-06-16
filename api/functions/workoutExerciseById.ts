import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { getNumericPathParam, json, parseJsonBody } from '../shared/http.js'
import { deleteExercise, getExerciseForWorkout, updateExercise, workoutExists } from '../shared/repository.js'
import {
  invalidExerciseEditForWorkoutMessage,
  requireExistingUser,
  requireWorkoutOwnership,
} from '../shared/validation.js'

interface UpdateExerciseBody {
  description?: string
  exerciseType?: string
  numSets?: number
  numReps?: number
  weightDescription?: string
  durationMinutes?: number
  speedMph?: number
  notes?: string
}

app.http('workoutExerciseById', {
  methods: ['PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'workouts/{workoutId}/exercises/{exerciseId}',
  handler: async (request: HttpRequest) => {
    const user = getSessionUser(request)
    if (!user || !(await requireExistingUser(user.username))) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const workoutId = getNumericPathParam(request, 'workoutId')
    const exerciseId = getNumericPathParam(request, 'exerciseId')

    if (!workoutId || !exerciseId) {
      return json(400, {
        error:
          'At least one of your url parameters is incorrect. Please ensure numeric values are used for pages and ids.',
      })
    }

    if (!(await workoutExists(workoutId))) {
      return json(404, { error: `Workout #${workoutId} doesn't exist.` })
    }

    const exercise = await getExerciseForWorkout(workoutId, exerciseId)
    if (!exercise) {
      return json(404, { error: `Exercise #${exerciseId} doesn't exist.` })
    }

    const ownership = await requireWorkoutOwnership(workoutId, user.username)
    if (!ownership.ok) {
      return json(403, {
        error: 'You are not allowed to edit another user\'s workout. You may only view this workout & its exercises.',
      })
    }

    if (request.method === 'DELETE') {
      await deleteExercise(exerciseId)
      return json(200, { message: `You removed ${exercise.description} from this workout.` })
    }

    const body = await parseJsonBody<UpdateExerciseBody>(request)
    const description = body.description ?? ''
    const exerciseType = body.exerciseType ?? exercise.exerciseType
    const numSets = body.numSets !== undefined ? Number(body.numSets) : exercise.numSets
    const numReps = body.numReps !== undefined ? Number(body.numReps) : exercise.numReps
    const weightDescription = body.weightDescription !== undefined ? body.weightDescription : exercise.weightDescription
    const durationMinutes = body.durationMinutes !== undefined ? Number(body.durationMinutes) : exercise.durationMinutes
    const speedMph = body.speedMph !== undefined ? Number(body.speedMph) : exercise.speedMph
    const notes = body.notes !== undefined ? body.notes : exercise.notes

    const invalidMsg = await invalidExerciseEditForWorkoutMessage(
      workoutId,
      exerciseId,
      description,
      weightDescription ?? '',
      exerciseType,
    )
    if (invalidMsg) {
      return json(422, { error: invalidMsg })
    }

    await updateExercise(
      exerciseId,
      description,
      numSets,
      numReps,
      weightDescription,
      exerciseType,
      durationMinutes,
      speedMph,
      notes,
    )
    return json(200, { message: `You've successfully updated exercise #${exerciseId}` })
  },
})
