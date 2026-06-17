import { beforeEach, describe, expect, it } from 'vitest'

import type { ConflictPayload, PendingOperation, WorkoutDetails } from '../types/domain'
import {
  createConflictStore,
  createPendingOperationStore,
  createWorkoutSnapshotStore,
} from './localStore'

const buildOperation = (overrides: Partial<PendingOperation> = {}): PendingOperation => ({
  operationId: overrides.operationId ?? 'op-1',
  deviceId: overrides.deviceId ?? 'device-1',
  entityType: overrides.entityType ?? 'workout',
  action: overrides.action ?? 'create',
  payload: overrides.payload ?? {
    clientId: 'workout-local-1',
    name: 'Offline Legs',
    date: '2026-06-16',
  },
  createdAt: overrides.createdAt ?? '2026-06-16T12:00:00.000Z',
  retryCount: overrides.retryCount ?? 0,
})

const buildWorkoutSnapshot = (overrides: Partial<WorkoutDetails> = {}): WorkoutDetails => ({
  id: overrides.id ?? -101,
  name: overrides.name ?? 'Offline Legs',
  date: overrides.date ?? '2026-06-16',
  username: overrides.username ?? 'Jane Doe',
  numSets: overrides.numSets ?? 0,
  numReps: overrides.numReps ?? 0,
  weightDescription: overrides.weightDescription ?? 'Pending sync',
  exercises: overrides.exercises ?? [],
  clientId: overrides.clientId ?? 'workout-local-1',
  lastSyncedAt: overrides.lastSyncedAt ?? null,
  pendingState: overrides.pendingState ?? 'pending',
})

const buildConflict = (overrides: Partial<ConflictPayload> = {}): ConflictPayload => ({
  operationId: overrides.operationId ?? 'op-1',
  entityType: overrides.entityType ?? 'workout',
  serverValue: overrides.serverValue ?? { id: 1, name: 'Server Workout' },
  clientValue: overrides.clientValue ?? { id: -101, name: 'Offline Workout' },
  detectedAt: overrides.detectedAt ?? '2026-06-16T12:30:00.000Z',
})

describe('createPendingOperationStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty when nothing has been queued yet', () => {
    const store = createPendingOperationStore(localStorage)

    expect(store.list()).toEqual([])
  })

  it('persists queued operations and preserves FIFO order across store instances', () => {
    const store = createPendingOperationStore(localStorage)
    const first = buildOperation({ operationId: 'op-1', createdAt: '2026-06-16T12:00:00.000Z' })
    const second = buildOperation({
      operationId: 'op-2',
      createdAt: '2026-06-16T12:01:00.000Z',
      payload: { clientId: 'workout-local-2', name: 'Offline Push', date: '2026-06-17' },
    })

    store.enqueue(first)
    store.enqueue(second)

    const reloadedStore = createPendingOperationStore(localStorage)

    expect(reloadedStore.list()).toEqual([first, second])
  })

  it('removes a queued operation by operation id', () => {
    const store = createPendingOperationStore(localStorage)
    const first = buildOperation({ operationId: 'op-1' })
    const second = buildOperation({ operationId: 'op-2' })

    store.enqueue(first)
    store.enqueue(second)
    store.remove('op-1')

    expect(store.list()).toEqual([second])
  })

  it('persists workout snapshots and can retrieve them by id', () => {
    const store = createWorkoutSnapshotStore(localStorage)
    const snapshot = buildWorkoutSnapshot()

    store.upsert(snapshot)

    expect(store.list()).toEqual([snapshot])
    expect(store.get(snapshot.id)).toEqual(snapshot)
  })

  it('replaces an existing workout snapshot when upserting the same id', () => {
    const store = createWorkoutSnapshotStore(localStorage)
    const initial = buildWorkoutSnapshot({ id: 7, name: 'Before Sync', clientId: undefined })
    const updated = buildWorkoutSnapshot({ id: 7, name: 'After Sync', clientId: undefined })

    store.upsert(initial)
    store.upsert(updated)

    expect(store.list()).toEqual([updated])
  })

  it('removes workout snapshots by id', () => {
    const store = createWorkoutSnapshotStore(localStorage)
    const first = buildWorkoutSnapshot({ id: -101 })
    const second = buildWorkoutSnapshot({ id: 8, clientId: undefined })

    store.upsert(first)
    store.upsert(second)
    store.remove(first.id)

    expect(store.list()).toEqual([second])
  })

  it('persists conflicts and can clear them by operation id', () => {
    const store = createConflictStore(localStorage)
    const first = buildConflict({ operationId: 'op-1' })
    const second = buildConflict({ operationId: 'op-2', entityType: 'exercise' })

    store.upsert(first)
    store.upsert(second)
    store.remove('op-1')

    expect(store.list()).toEqual([second])
  })
})