import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPendingOperationStore } from '../services/localStore'
import { syncService } from '../services/sync'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../services/api', () => ({
  api: {
    getCurrentUser: vi.fn().mockResolvedValue(null),
    logout: vi.fn().mockResolvedValue(undefined),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    exportAccountData: vi.fn().mockResolvedValue('{}'),
    updateFavoriteTeam: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../services/sync', () => ({
  syncService: {
    flush: vi.fn().mockResolvedValue({ processed: 0, conflicts: 0, lastError: null }),
  },
}))

const wrapper = ({ children }: PropsWithChildren): JSX.Element => <AuthProvider>{children}</AuthProvider>

describe('AuthContext sync status', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      onLine: true,
    })
  })

  it('exposes pending count from the local queue after load', async () => {
    const store = createPendingOperationStore(localStorage)
    store.enqueue({
      operationId: 'operation-1',
      deviceId: 'device-1',
      entityType: 'workout',
      action: 'create',
      payload: { clientId: 'workout-local-1', name: 'Offline Legs', date: '2026-06-16' },
      createdAt: '2026-06-16T12:00:00.000Z',
      retryCount: 0,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.pendingCount).toBe(1)
    expect(result.current.isOffline).toBe(false)
    expect(result.current.lastSyncError).toBeNull()
  })

  it('updates pending count and offline state when sync status changes', async () => {
    const store = createPendingOperationStore(localStorage)
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      store.enqueue({
        operationId: 'operation-2',
        deviceId: 'device-1',
        entityType: 'workout',
        action: 'create',
        payload: { clientId: 'workout-local-2', name: 'Offline Push', date: '2026-06-17' },
        createdAt: '2026-06-16T12:05:00.000Z',
        retryCount: 0,
      })
      window.dispatchEvent(new Event('offline'))
    })

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1)
      expect(result.current.isOffline).toBe(true)
    })
  })

  it('flushes pending changes when the app comes back online for an authenticated user', async () => {
    const store = createPendingOperationStore(localStorage)
    store.enqueue({
      operationId: 'operation-3',
      deviceId: 'device-1',
      entityType: 'workout',
      action: 'create',
      payload: { clientId: 'workout-local-3', name: 'Offline Pull', date: '2026-06-17' },
      createdAt: '2026-06-16T12:07:00.000Z',
      retryCount: 0,
    })

    const { api } = await import('../services/api')
    vi.mocked(api.getCurrentUser).mockResolvedValue({ username: 'Jane Doe' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      vi.stubGlobal('navigator', { onLine: true })
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(syncService.flush).toHaveBeenCalled()
    })
  })

  it('exposes a sync error after flush reports conflicts', async () => {
    vi.mocked(syncService.flush).mockResolvedValueOnce({
      processed: 0,
      conflicts: 1,
      lastError: 'Resolve sync conflicts to continue.',
    })

    const { api } = await import('../services/api')
    vi.mocked(api.getCurrentUser).mockResolvedValue({ username: 'Jane Doe' })

    const store = createPendingOperationStore(localStorage)
    store.enqueue({
      operationId: 'operation-4',
      deviceId: 'device-1',
      entityType: 'exercise',
      action: 'update',
      payload: { workoutId: 7, exerciseId: 11 },
      createdAt: '2026-06-16T12:09:00.000Z',
      retryCount: 0,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(result.current.lastSyncError).toBe('Resolve sync conflicts to continue.')
    })
  })
})