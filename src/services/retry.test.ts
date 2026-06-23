import { describe, expect, it, vi } from 'vitest'

import { calculateBackoff, isRetryableError, withRetry } from './retry'

describe('retry utilities', () => {
  describe('isRetryableError', () => {
    it('returns true for 5xx server errors', () => {
      expect(isRetryableError(500)).toBe(true)
      expect(isRetryableError(501)).toBe(true)
      expect(isRetryableError(502)).toBe(true)
      expect(isRetryableError(503)).toBe(true)
      expect(isRetryableError(504)).toBe(true)
      expect(isRetryableError(599)).toBe(true)
    })

    it('returns true for connection timeouts', () => {
      expect(isRetryableError('timeout')).toBe(true)
    })

    it('returns true for network errors', () => {
      expect(isRetryableError('network')).toBe(true)
    })

    it('returns false for 4xx client errors', () => {
      expect(isRetryableError(400)).toBe(false)
      expect(isRetryableError(401)).toBe(false)
      expect(isRetryableError(403)).toBe(false)
      expect(isRetryableError(404)).toBe(false)
      expect(isRetryableError(422)).toBe(false)
    })

    it('returns false for 2xx success', () => {
      expect(isRetryableError(200)).toBe(false)
      expect(isRetryableError(201)).toBe(false)
    })

    it('returns false for 3xx redirects', () => {
      expect(isRetryableError(300)).toBe(false)
      expect(isRetryableError(301)).toBe(false)
      expect(isRetryableError(302)).toBe(false)
    })

    it('returns false for unknown errors', () => {
      expect(isRetryableError('unknown')).toBe(false)
    })
  })

  describe('calculateBackoff', () => {
    it('returns exponential backoff starting at 100ms', () => {
      expect(calculateBackoff(0)).toBe(100) // Attempt 0 (first retry)
      expect(calculateBackoff(1)).toBe(200) // Attempt 1
      expect(calculateBackoff(2)).toBe(400) // Attempt 2
      expect(calculateBackoff(3)).toBe(800) // Attempt 3
    })

    it('caps backoff at maxDelay', () => {
      const maxDelay = 1000
      expect(calculateBackoff(0, maxDelay)).toBe(100)
      expect(calculateBackoff(1, maxDelay)).toBe(200)
      expect(calculateBackoff(2, maxDelay)).toBe(400)
      expect(calculateBackoff(3, maxDelay)).toBe(800)
      expect(calculateBackoff(4, maxDelay)).toBe(1000) // Capped at maxDelay
      expect(calculateBackoff(5, maxDelay)).toBe(1000) // Capped at maxDelay
    })

    it('uses default maxDelay if not provided', () => {
      const defaultMaxDelay = 30000
      expect(calculateBackoff(10)).toBe(defaultMaxDelay) // Would be 51200 without cap
    })

    it('adds jitter to prevent thundering herd', () => {
      const backoff = calculateBackoff(2, undefined, true)
      const baseBackoff = 400
      const min = baseBackoff * 0.8
      const max = baseBackoff * 1.2
      expect(backoff).toBeGreaterThanOrEqual(min)
      expect(backoff).toBeLessThanOrEqual(max)
    })
  })

  describe('withRetry', () => {
    it('succeeds on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on retryable error and succeeds', async () => {
      const fn = vi.fn()
      fn.mockRejectedValueOnce(new Error('500 Internal Server Error'))
      fn.mockResolvedValueOnce('success')

      const result = await withRetry(fn, {
        isRetryable: () => true,
        calculateBackoff: (attempt) => attempt * 10, // Fast backoff for tests
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('stops retrying after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Server error'))
      const isRetryable = vi.fn().mockReturnValue(true)

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          isRetryable,
          calculateBackoff: (attempt) => attempt * 10,
        }),
      ).rejects.toThrow('Server error')

      expect(fn).toHaveBeenCalledTimes(3)
      expect(isRetryable).toHaveBeenCalledTimes(2) // Called for attempts 0 and 1 failures
    })

    it('does not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('404 Not Found'))
      const isRetryable = vi.fn().mockReturnValue(false)

      await expect(
        withRetry(fn, {
          maxAttempts: 5,
          isRetryable,
          calculateBackoff: () => 10,
        }),
      ).rejects.toThrow('404 Not Found')

      expect(fn).toHaveBeenCalledTimes(1)
      expect(isRetryable).toHaveBeenCalledTimes(1)
    })

    it('respects configured max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Server error'))
      const isRetryable = vi.fn().mockReturnValue(true)

      await expect(
        withRetry(fn, {
          maxAttempts: 5,
          isRetryable,
          calculateBackoff: () => 1,
        }),
      ).rejects.toThrow('Server error')

      expect(fn).toHaveBeenCalledTimes(5)
    })

    it('calls calculateBackoff with correct attempt number', async () => {
      const fn = vi.fn()
      fn.mockRejectedValueOnce(new Error('Failed'))
      fn.mockRejectedValueOnce(new Error('Failed'))
      fn.mockResolvedValueOnce('success')

      const calculateBackoff = vi.fn().mockImplementation((attempt) => attempt * 10)
      const isRetryable = vi.fn().mockReturnValue(true)

      await withRetry(fn, {
        calculateBackoff,
        isRetryable,
      })

      expect(calculateBackoff).toHaveBeenNthCalledWith(1, 0) // First retry after attempt 0
      expect(calculateBackoff).toHaveBeenNthCalledWith(2, 1) // Second retry after attempt 1
    })

    it('passes operationId through retry wrapper', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 101, operationId: 'op-1' })

      const result = await withRetry(fn, {
        isRetryable: () => true,
        calculateBackoff: () => 1,
        operationId: 'op-1',
      })

      expect((result as Record<string, unknown>).operationId).toBe('op-1')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('emits retry attempt callbacks', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success')

      const onRetry = vi.fn()

      await withRetry(fn, {
        isRetryable: () => true,
        calculateBackoff: () => 1,
        onRetry,
      })

      expect(onRetry).toHaveBeenCalledWith({
        attempt: 1,
        delay: 1,
        error: expect.any(Error),
      })
    })

    it('waits for backoff delay before retrying', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success')

      const start = Date.now()
      const delay = 50

      await withRetry(fn, {
        isRetryable: () => true,
        calculateBackoff: () => delay,
      })

      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(delay - 10) // Allow ±10ms tolerance
    })
  })
})
