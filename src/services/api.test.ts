import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPendingOperationStore,
  createWorkoutSnapshotStore,
} from './localStore'
import { api, createApiClient } from './api'

const jsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const workoutSnapshot = {
  id: 7,
  name: 'Workout',
  date: '2026-06-16',
  username: 'Jane Doe',
  numSets: 3,
  numReps: 8,
  weightDescription: '135 lbs',
  exercises: [
    {
      id: 11,
      description: 'Bench Press',
      exerciseType: 'strength' as const,
      numSets: 3,
      numReps: 8,
      weightDescription: '135 lbs',
      durationMinutes: null,
      speedMph: null,
      notes: '',
    },
  ],
}

describe('api service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('validates login payload before calling API', async () => {
    await expect(api.login({ username: '   ', password: 'short' })).rejects.toThrow(
      'Please enter a username and a password with at least 10 characters.',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls login endpoint for valid payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await api.login({ username: 'Jane Doe', password: 'long-enough-password' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    )
  })

  it('rejects signup when GDPR consent is missing', async () => {
    await expect(
      api.signup({
        username: 'Jane Doe',
        password: 'long-enough-password',
        gdprConsentAccepted: false,
      }),
    ).rejects.toThrow('You must accept the privacy notice to create an account.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls signup endpoint with consent flag', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await api.signup({
      username: 'Jane Doe',
      password: 'long-enough-password',
      gdprConsentAccepted: true,
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/signup',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    )
  })

  it('returns null for 401 current user lookup', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))

    await expect(api.getCurrentUser()).resolves.toBeNull()
  })

  it('throws non-401 errors for current user lookup', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Server error' }, 500))

    await expect(api.getCurrentUser()).rejects.toThrow('Server error')
  })

  it('maps workout list response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 1,
            name: 'Upper Body',
            date: '2026-06-01',
            username: 'Jane Doe',
            numSets: 3,
            numReps: 8,
            weightDescription: 'bodyweight',
          },
        ],
        totalPages: 2,
      }),
    )

    const result = await api.listWorkouts(1)

    expect(fetch).toHaveBeenCalledWith('/api/workouts?page=1', expect.any(Object))
    expect(result.items[0].name).toBe('Upper Body')
    expect(result.totalPages).toBe(2)
  })

  it('merges local workout snapshots into the workout list', async () => {
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    snapshotStore.upsert({
      id: 1,
      name: 'Upper Body',
      date: '2026-06-01',
      username: 'Jane Doe',
      numSets: 3,
      numReps: 8,
      weightDescription: '140 lbs',
      exercises: [],
      lastSyncedAt: null,
      pendingState: 'pending',
    })
    snapshotStore.upsert({
      id: -101,
      name: 'Offline Legs',
      date: '2026-06-16',
      username: 'Jane Doe',
      numSets: 0,
      numReps: 0,
      weightDescription: 'Pending sync',
      exercises: [],
      clientId: 'workout-local-1',
      lastSyncedAt: null,
      pendingState: 'pending',
    })
    const mergedApi = createApiClient({ pendingStore, snapshotStore })

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 1,
            name: 'Upper Body',
            date: '2026-06-01',
            username: 'Jane Doe',
            numSets: 3,
            numReps: 8,
            weightDescription: '135 lbs',
          },
        ],
        totalPages: 1,
      }),
    )

    const result = await mergedApi.listWorkouts(1)

    expect(result.items).toEqual([
      expect.objectContaining({ id: -101, name: 'Offline Legs', pendingState: 'pending' }),
      expect.objectContaining({ id: 1, weightDescription: '140 lbs', pendingState: 'pending' }),
    ])
  })

  it('returns a locally persisted pending workout detail without calling the API', async () => {
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    snapshotStore.upsert({
      id: -101,
      name: 'Offline Legs',
      date: '2026-06-16',
      username: 'Jane Doe',
      numSets: 4,
      numReps: 10,
      weightDescription: 'bodyweight',
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
      clientId: 'workout-local-1',
      lastSyncedAt: null,
      pendingState: 'pending',
    })
    const mergedApi = createApiClient({ pendingStore, snapshotStore })

    const result = await mergedApi.getWorkout(-101)

    expect(fetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ id: -101, pendingState: 'pending' })
  })

  it('creates workout then fetches details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ id: 42, message: 'created' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 42, name: 'Upper Body', exercises: [] }))

    const result = await api.createWorkout({ name: 'Upper Body', date: '2026-06-01' })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/workouts', expect.objectContaining({ method: 'POST' }))
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/workouts/42', expect.any(Object))
    expect(result.id).toBe(42)
  })

  it('queues workout creation when offline and returns a pending workout draft', async () => {
    const fetchFn = vi.fn()
    const createId = vi
      .fn<() => string>()
      .mockReturnValueOnce('workout-local-1')
      .mockReturnValueOnce('operation-1')
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    const offlineApi = createApiClient({
      fetchFn,
      isOnline: () => false,
      createId,
      now: () => '2026-06-16T12:00:00.000Z',
      getDeviceId: () => 'device-1',
      pendingStore,
      snapshotStore,
    })

    const result = await offlineApi.createWorkout({ name: 'Offline Legs', date: '2026-06-16' })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      name: 'Offline Legs',
      date: '2026-06-16',
      clientId: 'workout-local-1',
      pendingState: 'pending',
      exercises: [],
    })
    expect(pendingStore.list()).toEqual([
      {
        operationId: 'operation-1',
        deviceId: 'device-1',
        entityType: 'workout',
        action: 'create',
        payload: {
          clientId: 'workout-local-1',
          name: 'Offline Legs',
          date: '2026-06-16',
        },
        createdAt: '2026-06-16T12:00:00.000Z',
        retryCount: 0,
      },
    ])
    expect(snapshotStore.get(result.id)).toMatchObject({
      id: result.id,
      clientId: 'workout-local-1',
      pendingState: 'pending',
    })
  })

  it('updates workout then fetches details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'updated' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Updated Workout', exercises: [] }))

    const result = await api.updateWorkout({ id: 7, name: 'Updated Workout', date: '2026-06-02' })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/workouts/7', expect.objectContaining({ method: 'PUT' }))
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/workouts/7', expect.any(Object))
    expect(result.name).toBe('Updated Workout')
  })

  it('creates exercise then fetches workout details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ id: 88, message: 'created' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Workout', exercises: [{ id: 88 }] }))

    const result = await api.createExercise(7, {
      description: 'Pull Ups',
      exerciseType: 'strength',
      numSets: 4,
      numReps: 10,
      weightDescription: 'bodyweight',
      notes: '',
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/7/exercises',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.exercises).toHaveLength(1)
  })

  it('queues exercise creation when offline and patches the provided workout snapshot', async () => {
    const fetchFn = vi.fn()
    const createId = vi
      .fn<() => string>()
      .mockReturnValueOnce('exercise-local-2')
      .mockReturnValueOnce('operation-3')
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    snapshotStore.upsert(workoutSnapshot)
    const offlineApi = createApiClient({
      fetchFn,
      isOnline: () => false,
      createId,
      now: () => '2026-06-16T12:10:00.000Z',
      getDeviceId: () => 'device-1',
      pendingStore,
      snapshotStore,
    })

    const result = await offlineApi.createExercise(
      7,
      {
        description: 'Pull Ups',
        exerciseType: 'strength',
        numSets: 4,
        numReps: 10,
        weightDescription: 'bodyweight',
        notes: '',
      },
      workoutSnapshot,
    )

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.exercises).toHaveLength(2)
    expect(result.exercises[1]).toMatchObject({
      clientId: 'exercise-local-2',
      description: 'Pull Ups',
      pendingState: 'pending',
    })
    expect(pendingStore.list()).toEqual([
      {
        operationId: 'operation-3',
        deviceId: 'device-1',
        entityType: 'exercise',
        action: 'create',
        payload: {
          workoutId: 7,
          clientId: 'exercise-local-2',
          description: 'Pull Ups',
          exerciseType: 'strength',
          numSets: 4,
          numReps: 10,
          weightDescription: 'bodyweight',
          notes: '',
        },
        createdAt: '2026-06-16T12:10:00.000Z',
        retryCount: 0,
      },
    ])
    expect(snapshotStore.get(7)?.exercises).toHaveLength(2)
  })

  it('updates exercise then fetches workout details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'updated' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Workout', exercises: [{ id: 11 }] }))

    const result = await api.updateExercise({
      workoutId: 7,
      exerciseId: 11,
      description: 'Bench Press',
      exerciseType: 'strength',
      numSets: 3,
      numReps: 8,
      weightDescription: '65 lbs',
      durationMinutes: undefined,
      speedMph: undefined,
      notes: '',
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/7/exercises/11',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(result.id).toBe(7)
  })

  it('queues exercise update when offline and patches the provided workout snapshot', async () => {
    const fetchFn = vi.fn()
    const createId = vi.fn<() => string>().mockReturnValueOnce('operation-4')
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    snapshotStore.upsert(workoutSnapshot)
    const offlineApi = createApiClient({
      fetchFn,
      isOnline: () => false,
      createId,
      now: () => '2026-06-16T12:15:00.000Z',
      getDeviceId: () => 'device-1',
      pendingStore,
      snapshotStore,
    })

    const result = await offlineApi.updateExercise(
      {
        workoutId: 7,
        exerciseId: 11,
        description: 'Incline Bench Press',
        exerciseType: 'strength',
        numSets: 3,
        numReps: 8,
        weightDescription: '140 lbs',
        notes: '',
      },
      workoutSnapshot,
    )

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.exercises[0]).toMatchObject({
      id: 11,
      description: 'Incline Bench Press',
      weightDescription: '140 lbs',
      pendingState: 'pending',
    })
    expect(pendingStore.list()).toEqual([
      {
        operationId: 'operation-4',
        deviceId: 'device-1',
        entityType: 'exercise',
        action: 'update',
        payload: {
          workoutId: 7,
          exerciseId: 11,
          description: 'Incline Bench Press',
          exerciseType: 'strength',
          numSets: 3,
          numReps: 8,
          weightDescription: '140 lbs',
          notes: '',
        },
        createdAt: '2026-06-16T12:15:00.000Z',
        retryCount: 0,
      },
    ])
    expect(snapshotStore.get(7)?.exercises[0]).toMatchObject({ pendingState: 'pending' })
  })

  it('deletes exercise then fetches workout details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'deleted' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Workout', exercises: [] }))

    const result = await api.deleteExercise(7, 11)

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/7/exercises/11',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/workouts/7', expect.any(Object))
    expect(result.exercises).toHaveLength(0)
  })

  it('queues exercise deletion when offline and patches the provided workout snapshot', async () => {
    const fetchFn = vi.fn()
    const createId = vi.fn<() => string>().mockReturnValueOnce('operation-5')
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    snapshotStore.upsert(workoutSnapshot)
    const offlineApi = createApiClient({
      fetchFn,
      isOnline: () => false,
      createId,
      now: () => '2026-06-16T12:20:00.000Z',
      getDeviceId: () => 'device-1',
      pendingStore,
      snapshotStore,
    })

    const result = await offlineApi.deleteExercise(7, 11, workoutSnapshot)

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.exercises).toEqual([])
    expect(pendingStore.list()).toEqual([
      {
        operationId: 'operation-5',
        deviceId: 'device-1',
        entityType: 'exercise',
        action: 'delete',
        payload: {
          workoutId: 7,
          exerciseId: 11,
        },
        createdAt: '2026-06-16T12:20:00.000Z',
        retryCount: 0,
      },
    ])
    expect(snapshotStore.get(7)?.exercises).toEqual([])
  })

  it('exports account data as JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ username: 'Jane Doe', exportedAt: '2026-06-15T00:00:00.000Z', workouts: [] }),
    )

    const result = await api.exportAccountData('json')

    expect(fetch).toHaveBeenCalledWith('/api/account/export?format=json', expect.any(Object))
    expect(result).toMatchObject({ username: 'Jane Doe' })
  })

  it('exports account data as CSV', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('username,workoutName\nJane Doe,Legs Day', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      }),
    )

    const result = await api.exportAccountData('csv')

    expect(fetch).toHaveBeenCalledWith('/api/account/export?format=csv', expect.any(Object))
    expect(result).toContain('Legs Day')
  })

  it('queues workout with first exercise when offline and returns a pending workout draft', async () => {
    const fetchFn = vi.fn()
    const createId = vi
      .fn<() => string>()
      .mockReturnValueOnce('workout-local-2')
      .mockReturnValueOnce('exercise-local-1')
      .mockReturnValueOnce('operation-2')
    const pendingStore = createPendingOperationStore(localStorage)
    const snapshotStore = createWorkoutSnapshotStore(localStorage)
    const offlineApi = createApiClient({
      fetchFn,
      isOnline: () => false,
      createId,
      now: () => '2026-06-16T12:05:00.000Z',
      getDeviceId: () => 'device-1',
      pendingStore,
      snapshotStore,
    })

    const result = await offlineApi.createWorkoutWithExercise(
      { name: 'Offline Push', date: '2026-06-16' },
      {
        description: 'Bench Press',
        exerciseType: 'strength',
        numSets: 3,
        numReps: 8,
        weightDescription: '135 lbs',
        notes: '',
      },
    )

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      name: 'Offline Push',
      clientId: 'workout-local-2',
      pendingState: 'pending',
      exercises: [
        {
          clientId: 'exercise-local-1',
          description: 'Bench Press',
          pendingState: 'pending',
        },
      ],
    })
    expect(pendingStore.list()).toEqual([
      {
        operationId: 'operation-2',
        deviceId: 'device-1',
        entityType: 'workout',
        action: 'create',
        payload: {
          clientId: 'workout-local-2',
          name: 'Offline Push',
          date: '2026-06-16',
          exercise: {
            clientId: 'exercise-local-1',
            description: 'Bench Press',
            exerciseType: 'strength',
            numSets: 3,
            numReps: 8,
            weightDescription: '135 lbs',
            notes: '',
          },
        },
        createdAt: '2026-06-16T12:05:00.000Z',
        retryCount: 0,
      },
    ])
    expect(snapshotStore.get(result.id)).toMatchObject({
      id: result.id,
      pendingState: 'pending',
      exercises: [expect.objectContaining({ description: 'Bench Press' })],
    })
  })
})
