import { app, type HttpRequest } from '@azure/functions'

import { getSessionUser } from '../shared/auth.js'
import { json, parseJsonBody } from '../shared/http.js'
import { addWorkout, countWorkouts, findUserIdByUsername, listWorkouts } from '../shared/repository.js'
import { invalidWorkoutMessage, requireExistingUser } from '../shared/validation.js'

interface CreateWorkoutBody {
  name?: string
  date?: string
}

app.http('workouts', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'workouts',
  handler: async (request: HttpRequest) => {
    const user = getSessionUser(request)
    if (!user || !(await requireExistingUser(user.username))) {
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
      const totalWorkouts = await countWorkouts()
      const totalPages = Math.max(1, Math.ceil(totalWorkouts / 10))
      const clampedPage = Math.min(Math.max(page, 1), totalPages)
      const offset = (clampedPage - 1) * 10
      const items = await listWorkouts(offset)

      return json(200, { items, totalPages, page: clampedPage })
    }

    const body = await parseJsonBody<CreateWorkoutBody>(request)
    const name = body.name?.trim() ?? ''
    const date = body.date ?? ''

    const invalidMsg = await invalidWorkoutMessage(name, date, user.username, null)
    if (invalidMsg) {
      return json(422, { error: invalidMsg })
    }

    const userId = await findUserIdByUsername(user.username)
    if (!userId) {
      return json(401, { error: 'Please login to access the Training Log App.' })
    }

    const newWorkoutId = await addWorkout(name, date, userId)

    return json(201, {
      id: newWorkoutId,
      message: "You've successfully created a new workout.",
    })
  },
})
