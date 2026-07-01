/**
 * Retry utilities for handling transient failures with exponential backoff
 */

/**
 * Determines if an error is retryable (transient failure)
 * @param error - Status code (number) or error type (string)
 * @returns true if the error should be retried
 */
export const isRetryableError = (error: number | string): boolean => {
  // 5xx server errors are retryable
  if (typeof error === 'number' && error >= 500 && error < 600) {
    return true
  }

  // Timeout and network errors are retryable
  if (error === 'timeout' || error === 'network') {
    return true
  }

  return false
}

/**
 * Calculates exponential backoff delay in milliseconds
 * @param attempt - Attempt number (0-based, first retry is attempt 0)
 * @param maxDelay - Maximum delay in milliseconds (default: 30000)
 * @param withJitter - Add ±20% jitter to prevent thundering herd
 * @returns Delay in milliseconds
 */
export const calculateBackoff = (
  attempt: number,
  maxDelay: number = 30000,
  withJitter: boolean = false,
): number => {
  // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, ...
  const baseDelay = 100 * Math.pow(2, attempt)
  let delay = Math.min(baseDelay, maxDelay)

  if (withJitter) {
    // Add ±20% jitter
    const jitterAmount = delay * 0.2
    const minJitter = delay - jitterAmount
    const maxJitter = delay + jitterAmount
    delay = Math.floor(Math.random() * (maxJitter - minJitter + 1)) + minJitter
  }

  return delay
}

interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean
  /** Function to calculate backoff delay */
  calculateBackoff?: (attempt: number) => number
  /** OperationId for idempotency (passed through) */
  operationId?: string
  /** Callback when a retry occurs */
  onRetry?: (info: { attempt: number; delay: number; error: Error }) => void
}

/**
 * Wraps a function with automatic retry logic
 * @param fn - Function to retry
 * @param options - Retry configuration
 * @returns Result from successful function call
 * @throws Last error after max attempts exhausted
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const maxAttempts = options.maxAttempts ?? 3
  const isRetryable = options.isRetryable ?? ((err: unknown) => {
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const message = String((err as Record<string, unknown>).message)
      // Extract status code from error message if present
      const statusMatch = message.match(/^(\d{3})/)
      if (statusMatch) {
        return isRetryableError(parseInt(statusMatch[1], 10))
      }
    }
    return false
  })
  const calculateBackoffDelay = options.calculateBackoff ?? calculateBackoff
  const onRetry = options.onRetry

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If this was the last attempt, throw immediately
      if (attempt === maxAttempts - 1) {
        throw lastError
      }

      // Check if error is retryable
      if (!isRetryable(lastError)) {
        throw lastError
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt)

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry({
          attempt: attempt + 1,
          delay,
          error: lastError,
        })
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
