import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { getNumericPathParam, json, parseJsonBody } from '../shared/http.js'
import { deleteWorkout, getWorkoutWithExercisesForUser, updateWorkout, workoutExists } from '../shared/repository.js'
import { invalidWorkoutMessage, requireExistingUser, requireWorkoutOwnership } from '../shared/validation.js'

interface UpdateWorkoutBody {
  name?: string
  date?: string
}

// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('workoutById', {
    methods: ['GET', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    route: 'workouts/{workoutId}',
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

    const workout = await getWorkoutWithExercisesForUser(workoutId, user.username)
    if (!workout) {
      if (await workoutExists(workoutId)) {
        return json(403, {
          error: 'You are not allowed to edit another user\'s workout. You may only view this workout & its exercises.',
        })
      }
      return json(404, { error: `Workout #${workoutId} doesn't exist.` })
    }

    if (request.method === 'GET') {
      return json(200, workout)
    }

    const ownership = await requireWorkoutOwnership(workoutId, user.username)
    if (!ownership.ok) {
      return json(403, {
        error: 'You are not allowed to edit another user\'s workout. You may only view this workout & its exercises.',
      })
    }

    if (request.method === 'DELETE') {
      await deleteWorkout(workoutId)
      return json(200, { message: `You successfully deleted workout #${workoutId}.` })
    }

    const body = await parseJsonBody<UpdateWorkoutBody>(request)
    const name = body.name?.trim() ?? ''
    const date = body.date ?? ''

    const invalidMsg = await invalidWorkoutMessage(name, date, user.username, workoutId)
    if (invalidMsg) {
      return json(422, { error: invalidMsg })
    }

    await updateWorkout(workoutId, name, date)
    return json(200, { message: `You've successfully updated workout ${workoutId}` })
  },
  })
}
