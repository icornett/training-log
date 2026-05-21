import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { getNumericPathParam, json, parseJsonBody } from '../shared/http.js'
import { addExercise, atExerciseLimit, getWorkoutDetails } from '../shared/repository.js'
import { invalidNewExerciseMessage, requireExistingUser, requireWorkoutOwnership } from '../shared/validation.js'

interface CreateExerciseBody {
  description?: string
  numSets?: number
  numReps?: number
  weightDescription?: string
}

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

    const workout = await getWorkoutDetails(workoutId)
    if (!workout) {
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
    const description = (body.description ?? '').replace(/[\p{P}\p{S}]/gu, '')
    const numSets = Number(body.numSets ?? 0)
    const numReps = Number(body.numReps ?? 0)
    const weightDescription = (body.weightDescription ?? '').toLowerCase()

    const invalidMsg = await invalidNewExerciseMessage(description, weightDescription, workoutId)
    if (invalidMsg) {
      return json(422, { error: invalidMsg })
    }

    const newExerciseId = await addExercise(workoutId, description, numSets, numReps, weightDescription)

    return json(201, {
      id: newExerciseId,
      message: `You've successfully added ${description} to your workout.`,
    })
  },
})
