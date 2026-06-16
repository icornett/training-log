import { app } from '@azure/functions'

import { clearSessionCookie } from '../shared/auth.js'
import { json } from '../shared/http.js'

// Skip registration during tests to avoid Azure Functions runtime detection warning
if (process.env.NODE_ENV !== 'test') {
  app.http('logout', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'logout',
    handler: async () => {
    return json(
      200,
      { ok: true },
      {
        'Set-Cookie': clearSessionCookie(),
      },
    )
  },
  })
}
