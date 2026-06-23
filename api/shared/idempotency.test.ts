import { describe, expect, it } from '@jest/globals'
import type { HttpRequest } from '@azure/functions'

import { extractOperationId } from './idempotency.js'

describe('extractOperationId', () => {
  it('extracts operationId from x-operation-id header', async () => {
    const request = {
      headers: new Map([['x-operation-id', 'op-uuid-123']]),
      method: 'GET',
    } as unknown as HttpRequest

    const result = await extractOperationId(request)
    expect(result).toBe('op-uuid-123')
  })

  it('extracts operationId from request body for POST', async () => {
    const request = {
      headers: new Map(),
      method: 'POST',
      json: async () => ({
        operationId: 'op-body-456',
        payload: { name: 'Test' },
      }),
    } as unknown as HttpRequest

    const result = await extractOperationId(request)
    expect(result).toBe('op-body-456')
  })

  it('returns null when operationId not found', async () => {
    const request = {
      headers: new Map(),
      method: 'GET',
    } as unknown as HttpRequest

    const result = await extractOperationId(request)
    expect(result).toBeNull()
  })

  it('prefers header over body when both exist', async () => {
    const request = {
      headers: new Map([['x-operation-id', 'op-header-789']]),
      method: 'POST',
      json: async () => ({
        operationId: 'op-body-456',
      }),
    } as unknown as HttpRequest

    const result = await extractOperationId(request)
    expect(result).toBe('op-header-789')
  })

  it('returns null when body JSON is invalid', async () => {
    const request = {
      headers: new Map(),
      method: 'POST',
      json: async () => {
        throw new Error('Invalid JSON')
      },
    } as unknown as HttpRequest

    const result = await extractOperationId(request)
    expect(result).toBeNull()
  })
})
