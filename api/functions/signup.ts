import { app, type HttpRequest } from '@azure/functions'

import { buildSessionCookie } from '../shared/auth.js'
import { GDPR_CONSENT_VERSION } from '../shared/gdpr.js'
import { json, parseJsonBody } from '../shared/http.js'
import { addUser, logGdprEvent } from '../shared/repository.js'
import { validNewUser } from '../shared/validation.js'

interface SignupBody {
  username?: string
  password?: string
  gdprConsentAccepted?: boolean
}

interface SignupDependencies {
  addUser: typeof addUser
  validateNewUser: typeof validNewUser
  buildCookie: typeof buildSessionCookie
  auditEvent: (username: string) => Promise<void>
}

export const createSignupHandler = (deps: SignupDependencies) => {
  return async (request: HttpRequest) => {
    const body = await parseJsonBody<SignupBody>(request)
    const username = body.username?.trim() ?? ''
    const password = body.password ?? ''
    const gdprConsentAccepted = body.gdprConsentAccepted === true

    if (!gdprConsentAccepted) {
      return json(422, {
        error: 'You must accept the privacy notice to create an account.',
      })
    }

    if (!(await deps.validateNewUser(username, password))) {
      return json(422, {
        error:
          'Usernames & passwords cannot exceed 25 characters, all usernames must be unique, and passwords must be at least 10 characters. Please try again.',
      })
    }

    const consentAt = new Date().toISOString()
    const consentIp = request.headers.get('x-forwarded-for')
    const consentUserAgent = request.headers.get('user-agent')

    await deps.addUser(username, password, {
      consentAt,
      consentVersion: GDPR_CONSENT_VERSION,
      consentIp,
      consentUserAgent,
    })
    await deps.auditEvent(username)

    return json(
      201,
      { ok: true, username },
      {
        'Set-Cookie': deps.buildCookie(username),
      },
    )
  }
}

const signupHandler = createSignupHandler({
  addUser,
  validateNewUser: validNewUser,
  buildCookie: buildSessionCookie,
  auditEvent: async (username) => {
    await logGdprEvent('gdpr_consent_recorded', username, {
      consentVersion: GDPR_CONSENT_VERSION,
    })
  },
})

app.http('signup', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'signup',
  handler: signupHandler,
})
