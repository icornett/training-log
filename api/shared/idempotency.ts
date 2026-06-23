import type { HttpRequest } from '@azure/functions'

/**
 * Extract operationId from Azure Function request.
 * Checks both headers and request body for the operationId.
 */
export const extractOperationId = async (request: HttpRequest): Promise<string | null> => {
  // Try to get from header first (preferred for GET/DELETE)
  const headerValue = request.headers.get('x-operation-id')
  if (headerValue) {
    return headerValue
  }

  // Try to get from request body for POST/PUT
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = (await request.json()) as Record<string, unknown>
      if (typeof body.operationId === 'string') {
        return body.operationId
      }
    } catch {
      // Body is not JSON or does not have operationId
    }
  }

  return null
}

/**
 * Type for idempotency response structure.
 * Used by handlers to return consistent response format.
 */
export interface IdempotencyContext {
  userId: number
  operationId: string
}
