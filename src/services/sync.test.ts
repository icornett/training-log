import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkoutDetails } from '../types/domain'
import {
  createConflictStore,
  createPendingOperationStore,
  createWorkoutSnapshotStore,
} from './localStore'
import { createSyncService } from './sync'

const jsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const workoutSnapshot = (overrides: Partial<WorkoutDetails> = {}): WorkoutDetails => ({
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

describe('createSyncService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('replays a queued pending workout with first exercise and clears local snapshot state', async () => {
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    const conflictStore = createConflictStore(localStorage)

    snapshotStore.upsert(
      workoutSnapshot({
        exercises: [
          {
            id: -201,
            description: 'Pull Ups',
            exerciseType: 'strength',
            numSets: 4,
            numReps: 10,
            weightDescription: 'bodyweight',
            durationMinutes: null,
            speedMph: null,
            notes: '',
            clientId: 'exercise-local-1',
            lastSyncedAt: null,
            pendingState: 'pending',
          },
        ],
      }),
    )

    pendingStore.enqueue({
      operationId: 'op-1',
      deviceId: 'device-1',
      entityType: 'workout',
      action: 'create',
      payload: {
        clientId: 'workout-local-1',
        name: 'Offline Legs',
        date: '2026-06-16',
        exercise: {
          clientId: 'exercise-local-1',
          description: 'Pull Ups',
          exerciseType: 'strength',
          numSets: 4,
          numReps: 10,
          weightDescription: 'bodyweight',
          notes: '',
        },
      },
      createdAt: '2026-06-16T12:00:00.000Z',
      retryCount: 0,
    })

    const fetchFn = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        id: 7,
        name: 'Offline Legs',
        date: '2026-06-16',
        username: 'Jane Doe',
        numSets: 4,
        numReps: 10,
        weightDescription: 'bodyweight',
        exercises: [
          {
            id: 99,
            description: 'Pull Ups',
            exerciseType: 'strength',
            numSets: 4,
            numReps: 10,
            weightDescription: 'bodyweight',
            durationMinutes: null,
            speedMph: null,
            notes: '',
          },
        ],
      }, 201),
    )

    const sync = createSyncService({
      fetchFn,
      pendingStore,
      snapshotStore,
      conflictStore,
      isOnline: () => true,
      now: () => '2026-06-16T12:10:00.000Z',
    })

    const result = await sync.flush()

    expect(result).toEqual({ processed: 1, conflicts: 0, lastError: null })
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/workouts/with-first-exercise',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(pendingStore.list()).toEqual([])
    expect(snapshotStore.list()).toEqual([])
    expect(conflictStore.list()).toEqual([])
  })

  it('replays queued exercise operations after creating a pending workout', async () => {
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    const conflictStore = createConflictStore(localStorage)

    snapshotStore.upsert(
      workoutSnapshot({
        exercises: [
          {
            id: -201,
            description: 'Pull Ups',
            exerciseType: 'strength',
            numSets: 4,
            numReps: 10,
            weightDescription: 'bodyweight',
            durationMinutes: null,
            speedMph: null,
            notes: '',
            clientId: 'exercise-local-1',
            lastSyncedAt: null,
            pendingState: 'pending',
          },
          {
            id: -202,
            description: 'Deadlift',
            exerciseType: 'strength',
            numSets: 3,
            numReps: 5,
            weightDescription: '225 lbs',
            durationMinutes: null,
            speedMph: null,
            notes: '',
            clientId: 'exercise-local-2',
            lastSyncedAt: null,
            pendingState: 'pending',
          },
        ],
      }),
    )

    pendingStore.enqueue({
      operationId: 'op-1',
      deviceId: 'device-1',
      entityType: 'workout',
      action: 'create',
      payload: {
        clientId: 'workout-local-1',
        name: 'Offline Legs',
        date: '2026-06-16',
        exercise: {
          clientId: 'exercise-local-1',
          description: 'Pull Ups',
          exerciseType: 'strength',
          numSets: 4,
          numReps: 10,
          weightDescription: 'bodyweight',
          notes: '',
        },
      },
      createdAt: '2026-06-16T12:00:00.000Z',
      retryCount: 0,
    })

    pendingStore.enqueue({
      operationId: 'op-2',
      deviceId: 'device-1',
      entityType: 'exercise',
      action: 'create',
      payload: {
        workoutId: -101,
        workoutClientId: 'workout-local-1',
        clientId: 'exercise-local-2',
        description: 'Deadlift',
        exerciseType: 'strength',
        numSets: 3,
        numReps: 5,
        weightDescription: '225 lbs',
        notes: '',
      },
      createdAt: '2026-06-16T12:01:00.000Z',
      retryCount: 0,
    })

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 7,
          name: 'Offline Legs',
          date: '2026-06-16',
          username: 'Jane Doe',
          numSets: 4,
          numReps: 10,
          weightDescription: 'bodyweight',
          exercises: [
            {
              id: 99,
              description: 'Pull Ups',
              exerciseType: 'strength',
              numSets: 4,
              numReps: 10,
              weightDescription: 'bodyweight',
              durationMinutes: null,
              speedMph: null,
              notes: '',
            },
          ],
        }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 100, message: 'Exercise created.' }, 201))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 7,
          name: 'Offline Legs',
          date: '2026-06-16',
          username: 'Jane Doe',
          numSets: 7,
          numReps: 15,
          weightDescription: '225 lbs',
          exercises: [
            {
              id: 99,
              description: 'Pull Ups',
              exerciseType: 'strength',
              numSets: 4,
              numReps: 10,
              weightDescription: 'bodyweight',
              durationMinutes: null,
              speedMph: null,
              notes: '',
            },
            {
              id: 100,
              description: 'Deadlift',
              exerciseType: 'strength',
              numSets: 3,
              numReps: 5,
              weightDescription: '225 lbs',
              durationMinutes: null,
              speedMph: null,
              notes: '',
            },
          ],
        }),
      )

    const sync = createSyncService({
      fetchFn,
      pendingStore,
      snapshotStore,
      conflictStore,
      isOnline: () => true,
      now: () => '2026-06-16T12:10:00.000Z',
    })

    const result = await sync.flush()

    expect(result).toEqual({ processed: 2, conflicts: 0, lastError: null })
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      '/api/workouts/7/exercises',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(pendingStore.list()).toEqual([])
    expect(snapshotStore.list()).toEqual([])
  })

  it('stores a conflict when replay fails and keeps the workout snapshot for resolution', async () => {
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    const conflictStore = createConflictStore(localStorage)

    snapshotStore.upsert(
      workoutSnapshot({
        id: 7,
        clientId: undefined,
        exercises: [
          {
            id: 11,
            description: 'Bench Press',
            exerciseType: 'strength',
            numSets: 3,
            numReps: 8,
            weightDescription: '140 lbs',
            durationMinutes: null,
            speedMph: null,
            notes: '',
            lastSyncedAt: null,
            pendingState: 'pending',
          },
        ],
      }),
    )

    pendingStore.enqueue({
      operationId: 'op-3',
      deviceId: 'device-1',
      entityType: 'exercise',
      action: 'update',
      payload: {
        workoutId: 7,
        exerciseId: 11,
        description: 'Bench Press',
        exerciseType: 'strength',
        numSets: 3,
        numReps: 8,
        weightDescription: '140 lbs',
        notes: '',
      },
      createdAt: '2026-06-16T12:00:00.000Z',
      retryCount: 0,
    })

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Server version changed.' }, 409))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 7,
          name: 'Upper Body',
          date: '2026-06-16',
          username: 'Jane Doe',
          numSets: 3,
          numReps: 8,
          weightDescription: '135 lbs',
          exercises: [
            {
              id: 11,
              description: 'Bench Press',
              exerciseType: 'strength',
              numSets: 3,
              numReps: 8,
              weightDescription: '135 lbs',
              durationMinutes: null,
              speedMph: null,
              notes: '',
            },
          ],
        }),
      )

    const sync = createSyncService({
      fetchFn,
      pendingStore,
      snapshotStore,
      conflictStore,
      isOnline: () => true,
      now: () => '2026-06-16T12:10:00.000Z',
    })

    const result = await sync.flush()

    expect(result).toEqual({ processed: 0, conflicts: 1, lastError: 'Server version changed.' })
    expect(conflictStore.list()).toEqual([
      {
        operationId: 'op-3',
        entityType: 'exercise',
        serverValue: expect.objectContaining({ id: 7 }),
        clientValue: expect.objectContaining({ workoutId: 7, exerciseId: 11 }),
        detectedAt: '2026-06-16T12:10:00.000Z',
      },
    ])
    expect(snapshotStore.get(7)).toMatchObject({ pendingState: 'conflict' })
    expect(pendingStore.list()).toHaveLength(1)
  })
})
