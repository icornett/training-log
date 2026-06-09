import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Node.js 22+ defines a built-in `localStorage` that lacks Web Storage methods.
  // Override it with a proper in-memory mock so both component code and test code
  // use the same, fully-functional implementation.
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value.toString()
    },
    removeItem: (key: string): void => {
      delete store[key]
    },
    clear: (): void => {
      Object.keys(store).forEach((k) => delete store[k])
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})
