import { createHmac, timingSafeEqual } from 'crypto'

import type { HttpRequest } from '@azure/functions'
import { parse } from 'cookie'

import type { SessionUser } from './types.js'

const COOKIE_NAME = 'training_log_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const secret = process.env.SESSION_SECRET ?? 'training-log-local-dev-secret-change-me'

interface SessionPayload {
  username: string
  exp: number
}

const toBase64Url = (value: string): string => {
  return Buffer.from(value, 'utf8').toString('base64url')
}

const fromBase64Url = (value: string): string => {
  return Buffer.from(value, 'base64url').toString('utf8')
}

const sign = (payloadB64: string): string => {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

const encodeToken = (payload: SessionPayload): string => {
  const payloadB64 = toBase64Url(JSON.stringify(payload))
  const signature = sign(payloadB64)
  return `${payloadB64}.${signature}`
}

const decodeToken = (token: string): SessionPayload | null => {
  const [payloadB64, signature] = token.split('.')

  if (!payloadB64 || !signature) {
    return null
  }

  const expected = sign(payloadB64)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadB64)) as SessionPayload
    if (!payload.username || typeof payload.exp !== 'number') {
      return null
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export const buildSessionCookie = (username: string): string => {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const token = encodeToken({ username, exp })
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`
}

export const clearSessionCookie = (): string => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`
}

export const getSessionUser = (request: HttpRequest): SessionUser | null => {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) {
    return null
  }

  const cookies = parse(cookieHeader)
  const token = cookies[COOKIE_NAME]
  if (!token) {
    return null
  }

  const payload = decodeToken(token)
  if (!payload) {
    return null
  }

  return { username: payload.username }
}
