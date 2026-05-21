import { app, type HttpRequest } from '@azure/functions'

import { buildSessionCookie } from '../shared/auth.js'
import { json, parseJsonBody } from '../shared/http.js'
import { addUser } from '../shared/repository.js'
import { validNewUser } from '../shared/validation.js'

interface SignupBody {
  username?: string
  password?: string
}

app.http('signup', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'signup',
  handler: async (request: HttpRequest) => {
    const body = await parseJsonBody<SignupBody>(request)
    const username = body.username?.trim() ?? ''
    const password = body.password ?? ''

    if (!(await validNewUser(username, password))) {
      return json(422, {
        error:
          'Usernames & passwords cannot exceed 25 characters, all usernames must be unique, and passwords must be at least 10 characters. Please try again.',
      })
    }

    await addUser(username, password)

    return json(
      201,
      { ok: true, username },
      {
        'Set-Cookie': buildSessionCookie(username),
      },
    )
  },
})
