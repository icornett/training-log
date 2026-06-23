import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSyncService } from '../services/sync'
import { createPendingOperationStore } from '../services/localStore'
import { SyncProvider, useSync } from './SyncContext'

vi.mock('../services/sync')
vi.mock('../services/localStore')

const wrapper = ({ children }: PropsWithChildren): JSX.Element => <SyncProvider>{children}</SyncProvider>

describe('SyncContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetAllMocks()
    vi.stubGlobal('navigator', { onLine: true })

    // Set up default mocks
    vi.mocked(createSyncService).mockReturnValue({
      flush: vi.fn().mockResolvedValue({ processed: 0, conflicts: 0, lastError: null }),
    } as any)

    vi.mocked(createPendingOperationStore).mockReturnValue({
      list: vi.fn().mockReturnValue([]),
      enqueue: vi.fn(),
      remove: vi.fn(),
    } as any)
  })

  it('provides initial sync state when offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { result } = renderHook(() => useSync(), { wrapper })
    expect(result.current.isOnline).toBe(false)
    expect(result.current.isSyncing).toBe(false)
  })

  it('exposes pending operation count from queue', async () => {
    // Create a stateful mock that tracks operations
    const operations: any[] = []
    const mockStore = {
      list: vi.fn(() => operations),
      enqueue: vi.fn((op: any) => {
        operations.push(op)
      }),
      remove: vi.fn((opId: string) => {
        const idx = operations.findIndex((o) => o.operationId === opId)
        if (idx !== -1) operations.splice(idx, 1)
      }),
    }
    vi.mocked(createPendingOperationStore).mockReturnValue(mockStore as any)

    const { result } = renderHook(() => useSync(), { wrapper })
    expect(result.current.pendingCount).toBe(0)

    // Simulate an operation being enqueued
    mockStore.enqueue({
      operationId: 'op-1',
      deviceId: 'device-1',
      entityType: 'workout',
      action: 'create',
      payload: { name: 'Offline Legs', date: '2026-06-16' },
      createdAt: '2026-06-16T12:00:00Z',
      retryCount: 0,
    })

    // Trigger sync status change event to update UI
    await act(async () => {
      window.dispatchEvent(new Event('trainingLog:sync-status-changed'))
    })

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1)
    })
  })

  it('auto-flushes queue when transitioning from offline to online', async () => {
    const flushSpy = vi.fn().mockResolvedValue({ processed: 1, conflicts: 0, lastError: null })

    vi.mocked(createSyncService).mockReturnValue({
      flush: flushSpy,
    } as any)

    // Create stateful mock with pending operations
    const operations = [
      {
        operationId: 'op-1',
        deviceId: 'device-1',
        entityType: 'exercise',
        action: 'create',
        payload: { workoutId: 1, description: 'Bench Press' },
        createdAt: '2026-06-16T12:00:00Z',
        retryCount: 0,
      },
    ]

    const mockStore = {
      list: vi.fn(() => operations),
      enqueue: vi.fn(),
      remove: vi.fn(),
    }
    vi.mocked(createPendingOperationStore).mockReturnValue(mockStore as any)

    vi.stubGlobal('navigator', { onLine: false })
    const { result } = renderHook(() => useSync(), { wrapper })

    expect(result.current.isOnline).toBe(false)

    // Simulate coming back online
    vi.stubGlobal('navigator', { onLine: true })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(flushSpy).toHaveBeenCalled()
    })
  })

  it('tracks sync errors and exposes lastError', async () => {
    const flushSpy = vi.fn().mockResolvedValue({
      processed: 0,
      conflicts: 1,
      lastError: 'Network error: 503 Service Unavailable',
    })

    vi.mocked(createSyncService).mockReturnValue({
      flush: flushSpy,
    })

    const { result } = renderHook(() => useSync(), { wrapper })

    // Trigger manual flush
    await act(async () => {
      await result.current.flushManually()
    })

    await waitFor(() => {
      expect(result.current.lastError).toBe('Network error: 503 Service Unavailable')
    })
  })

  it('updates pending count after successful sync', async () => {
    const flushSpy = vi.fn().mockResolvedValue({ processed: 1, conflicts: 0, lastError: null })

    vi.mocked(createSyncService).mockReturnValue({
      flush: flushSpy,
    } as any)

    // Create stateful mock with pending operations
    const operations = [
      {
        operationId: 'op-1',
        deviceId: 'device-1',
        entityType: 'workout',
        action: 'create',
        payload: { name: 'Legs' },
        createdAt: '2026-06-16T12:00:00Z',
        retryCount: 0,
      },
    ]

    const mockStore = {
      list: vi.fn(() => operations),
      enqueue: vi.fn(),
      remove: vi.fn((opId: string) => {
        const idx = operations.findIndex((o) => o.operationId === opId)
        if (idx !== -1) operations.splice(idx, 1)
      }),
    }
    vi.mocked(createPendingOperationStore).mockReturnValue(mockStore as any)

    const { result } = renderHook(() => useSync(), { wrapper })

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1)
    })

    await act(async () => {
      await result.current.flushManually()
    })

    // After flush, operations should be removed from the queue
    mockStore.remove('op-1')

    await act(async () => {
      window.dispatchEvent(new Event('trainingLog:sync-status-changed'))
    })

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0)
    })
  })

  it('exposes retryAttempt count as 0 when not retrying', () => {
    const { result } = renderHook(() => useSync(), { wrapper })
    expect(result.current.retryAttempt).toBe(0)
  })

  it('resets retryAttempt to 0 after successful sync', async () => {
    const flushSpy = vi.fn().mockResolvedValue({ processed: 1, conflicts: 0, lastError: null })

    vi.mocked(createSyncService).mockReturnValue({
      flush: flushSpy,
    } as any)

    const { result } = renderHook(() => useSync(), { wrapper })

    await act(async () => {
      await result.current.flushManually()
    })

    await waitFor(() => {
      expect(result.current.retryAttempt).toBe(0)
    })
  })
})
