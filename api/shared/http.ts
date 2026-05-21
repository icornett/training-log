import type { HttpRequest, HttpResponseInit } from '@azure/functions'

export const json = (status: number, body: unknown, extraHeaders?: Record<string, string>): HttpResponseInit => {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    jsonBody: body,
  }
}

export const parseJsonBody = async <T>(request: HttpRequest): Promise<T> => {
  return (await request.json()) as T
}

export const getNumericPathParam = (request: HttpRequest, key: string): number | null => {
  const raw = request.params[key]
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }

  return Number(raw)
}
