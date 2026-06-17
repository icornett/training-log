import type {
  AccountExportData,
  Credentials,
  ExerciseInput,
  ExerciseUpdateInput,
  PendingOperation,
  SessionUser,
  SignupCredentials,
  WorkoutCreateInput,
  WorkoutDetails,
  WorkoutListItem,
  WorkoutUpdateInput,
} from '../types/domain'
import {
  createPendingOperationStore,
  createWorkoutSnapshotStore,
  type ConflictStore,
  type PendingOperationStore,
  type WorkoutSnapshotStore,
} from './localStore'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

const deviceIdStorageKey = 'trainingLog:deviceId'

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const body = (await response.json()) as { error?: string; message?: string }
      message = body.error ?? body.message ?? message
    } catch {
      // Ignore non-json error responses.
    }

    throw new ApiError(response.status, message)
  }

  return (await response.json()) as T
}

const createRequest =
  (getFetch: () => typeof fetch) =>
  async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await getFetch()(path, {
      credentials: 'same-origin',
      ...init,
    })
    return parseJson<T>(response)
  }

const getBrowserStorage = (): Storage | null => {
  if (typeof localStorage === 'undefined') {
    return null
  }

  return localStorage
}

const createFallbackPendingStore = (): PendingOperationStore => ({
  list: () => [],
  enqueue: () => undefined,
  remove: () => undefined,
})

const createFallbackWorkoutSnapshotStore = (): WorkoutSnapshotStore => ({
  list: () => [],
  get: () => null,
  upsert: () => undefined,
  remove: () => undefined,
})

const getPendingStore = (): PendingOperationStore => {
  const storage = getBrowserStorage()
  return storage ? createPendingOperationStore(storage) : createFallbackPendingStore()
}

const getWorkoutSnapshotStore = (): WorkoutSnapshotStore => {
  const storage = getBrowserStorage()
  return storage ? createWorkoutSnapshotStore(storage) : createFallbackWorkoutSnapshotStore()
}

const getBrowserDeviceId = (): string => {
  const storage = getBrowserStorage()
  if (!storage) {
    return crypto.randomUUID()
  }

  const existing = storage.getItem(deviceIdStorageKey)
  if (existing) {
    return existing
  }

  const created = crypto.randomUUID()
  storage.setItem(deviceIdStorageKey, created)
  return created
}

const buildPendingWorkoutDraft = (
  payload: WorkoutCreateInput,
  clientId: string,
  createdAt: string,
): WorkoutDetails => ({
  id: -Math.abs(Date.parse(createdAt) || Date.now()),
  name: payload.name,
  date: payload.date,
  username: 'Pending sync',
  numSets: 0,
  numReps: 0,
  weightDescription: 'Pending sync',
  exercises: [],
  clientId,
  lastSyncedAt: null,
  pendingState: 'pending',
})

const buildPendingExerciseDraft = (payload: ExerciseInput, clientId: string) => ({
  id: -Math.abs(Date.now()),
  description: payload.description,
  exerciseType: payload.exerciseType,
  numSets: payload.numSets ?? null,
  numReps: payload.numReps ?? null,
  weightDescription: payload.weightDescription ?? null,
  durationMinutes: payload.durationMinutes ?? null,
  speedMph: payload.speedMph ?? null,
  notes: payload.notes ?? null,
  clientId,
  lastSyncedAt: null,
  pendingState: 'pending' as const,
})

const markWorkoutPending = (workout: WorkoutDetails): WorkoutDetails => ({
  ...workout,
  lastSyncedAt: null,
  pendingState: 'pending',
})

const patchExerciseInWorkout = (
  workout: WorkoutDetails,
  exerciseId: number,
  payload: ExerciseInput,
): WorkoutDetails => ({
  ...markWorkoutPending(workout),
  exercises: workout.exercises.map((exercise) =>
    exercise.id === exerciseId
      ? {
          ...exercise,
          description: payload.description,
          exerciseType: payload.exerciseType,
          numSets: payload.numSets ?? null,
          numReps: payload.numReps ?? null,
          weightDescription: payload.weightDescription ?? null,
          durationMinutes: payload.durationMinutes ?? null,
          speedMph: payload.speedMph ?? null,
          notes: payload.notes ?? null,
          lastSyncedAt: null,
          pendingState: 'pending',
        }
      : exercise,
  ),
})

const toWorkoutListItem = (workout: WorkoutDetails): WorkoutListItem => ({
  id: workout.id,
  name: workout.name,
  date: workout.date,
  username: workout.username,
  numSets: workout.numSets,
  numReps: workout.numReps,
  weightDescription: workout.weightDescription,
  clientId: workout.clientId,
  lastSyncedAt: workout.lastSyncedAt ?? null,
  pendingState: workout.pendingState,
})

const sortWorkoutsByDateDesc = <T extends { date: string; id: number }>(workouts: T[]): T[] => {
  return [...workouts].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date)
    if (dateCompare !== 0) {
      return dateCompare
    }

    return left.id - right.id
  })
}

interface ApiClientDeps {
  fetchFn: typeof fetch
  isOnline: () => boolean
  createId: () => string
  now: () => string
  getDeviceId: () => string
  pendingStore: PendingOperationStore
  snapshotStore: WorkoutSnapshotStore
  conflictStore: ConflictStore
}

export const createApiClient = (deps: Partial<ApiClientDeps> = {}) => {
  const getFetch = () => deps.fetchFn ?? fetch
  const request = createRequest(getFetch)
  const isOnline = deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const createId = deps.createId ?? (() => crypto.randomUUID())
  const now = deps.now ?? (() => new Date().toISOString())
  const getDeviceId = deps.getDeviceId ?? getBrowserDeviceId
  const pendingStore = deps.pendingStore ?? getPendingStore()
  const snapshotStore = deps.snapshotStore ?? getWorkoutSnapshotStore()
  return {
    async login(payload: Credentials): Promise<void> {
      if (payload.username.trim().length === 0 || payload.password.length < 10) {
        throw new Error('Please enter a username and a password with at least 10 characters.')
      }

      await request<void>('/api/login', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
    },

    async signup(payload: SignupCredentials): Promise<void> {
      if (payload.username.trim().length === 0 || payload.password.length < 10) {
        throw new Error('Please enter a unique username and a password with at least 10 characters.')
      }

      if (!payload.gdprConsentAccepted) {
        throw new Error('You must accept the privacy notice to create an account.')
      }

      await request<void>('/api/signup', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
    },

  async getCurrentUser(): Promise<SessionUser | null> {
    try {
      return await request<SessionUser>('/api/account')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null
      }

      throw error
    }
  },

  async logout(): Promise<void> {
    await request<void>('/api/logout', {
      method: 'POST',
    })
  },

  async deleteAccount(): Promise<void> {
    await request<void>('/api/account', {
      method: 'DELETE',
    })
  },

    async exportAccountData(format: 'json' | 'csv'): Promise<AccountExportData | string> {
      const response = await getFetch()(`/api/account/export?format=${format}`, {
        credentials: 'same-origin',
        method: 'GET',
      })

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`
        try {
          const body = (await response.json()) as { error?: string; message?: string }
          message = body.error ?? body.message ?? message
        } catch {
          // Ignore non-json error responses.
        }
        throw new ApiError(response.status, message)
      }

      if (format === 'csv') {
        return response.text()
      }

      return (await response.json()) as AccountExportData
    },

  async listWorkouts(pageNumber: number): Promise<{ items: WorkoutListItem[]; totalPages: number }> {
    const response = await request<{ items: WorkoutListItem[]; totalPages: number }>(
      `/api/workouts?page=${pageNumber}`,
    )

    const serverItems = response.items.map((item) => ({
      id: item.id,
      name: item.name,
      date: item.date,
      username: item.username,
      numSets: item.numSets,
      numReps: item.numReps,
      weightDescription: item.weightDescription,
      clientId: item.clientId,
      lastSyncedAt: item.lastSyncedAt ?? null,
      pendingState: item.pendingState,
    }))

    const snapshots = snapshotStore.list().map(toWorkoutListItem)
    const mergedExisting = serverItems.map((item) => snapshots.find((snapshot) => snapshot.id === item.id) ?? item)
    const pendingOnly = snapshots.filter((snapshot) => snapshot.id < 0)

    return {
      items: sortWorkoutsByDateDesc([...pendingOnly, ...mergedExisting]),
      totalPages: response.totalPages,
    }
  },

  async getWorkout(id: number): Promise<WorkoutDetails | null> {
    const snapshot = snapshotStore.get(id)
    if (snapshot) {
      return snapshot
    }

    return await request<WorkoutDetails>(`/api/workouts/${id}`)
  },

  async createWorkout(payload: WorkoutCreateInput): Promise<WorkoutDetails> {
    if (!isOnline()) {
      const clientId = createId()
      const createdAt = now()
      const pendingOperation: PendingOperation = {
        operationId: createId(),
        deviceId: getDeviceId(),
        entityType: 'workout',
        action: 'create',
        payload: {
          clientId,
          name: payload.name,
          date: payload.date,
        },
        createdAt,
        retryCount: 0,
      }

      pendingStore.enqueue(pendingOperation)
      const draft = buildPendingWorkoutDraft(payload, clientId, createdAt)
      snapshotStore.upsert(draft)
      return draft
    }

    const created = await request<{ id: number; message: string }>('/api/workouts', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })

    const workout = await request<WorkoutDetails>(`/api/workouts/${created.id}`)
    return workout
  },

  async updateWorkout(payload: WorkoutUpdateInput): Promise<WorkoutDetails> {
    await request<{ message: string }>(`/api/workouts/${payload.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: payload.name,
        date: payload.date,
      }),
    })

    return await request<WorkoutDetails>(`/api/workouts/${payload.id}`)
  },

  async deleteWorkout(workoutId: number): Promise<void> {
    await request<{ message: string }>(`/api/workouts/${workoutId}`, {
      method: 'DELETE',
    })
  },

  async createExercise(
    workoutId: number,
    payload: ExerciseInput,
    workoutSnapshot?: WorkoutDetails,
  ): Promise<WorkoutDetails> {
    if (!isOnline() && workoutSnapshot) {
      const clientId = createId()
      pendingStore.enqueue({
        operationId: createId(),
        deviceId: getDeviceId(),
        entityType: 'exercise',
        action: 'create',
        payload: {
          workoutId,
          workoutClientId: workoutSnapshot.clientId,
          clientId,
          ...payload,
        },
        createdAt: now(),
        retryCount: 0,
      })

      const patchedWorkout = {
        ...markWorkoutPending(workoutSnapshot),
        exercises: [...workoutSnapshot.exercises, buildPendingExerciseDraft(payload, clientId)],
      }
      snapshotStore.upsert(patchedWorkout)
      return patchedWorkout
    }

    await request<{ id: number; message: string }>(`/api/workouts/${workoutId}/exercises`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })

    return await request<WorkoutDetails>(`/api/workouts/${workoutId}`)
  },

  async updateExercise(
    payload: ExerciseUpdateInput,
    workoutSnapshot?: WorkoutDetails,
  ): Promise<WorkoutDetails> {
    if (!isOnline() && workoutSnapshot) {
      pendingStore.enqueue({
        operationId: createId(),
        deviceId: getDeviceId(),
        entityType: 'exercise',
        action: 'update',
        payload: {
          workoutId: payload.workoutId,
          workoutClientId: workoutSnapshot.clientId,
          exerciseId: payload.exerciseId,
          description: payload.description,
          exerciseType: payload.exerciseType,
          numSets: payload.numSets,
          numReps: payload.numReps,
          weightDescription: payload.weightDescription,
          durationMinutes: payload.durationMinutes,
          speedMph: payload.speedMph,
          notes: payload.notes,
        },
        createdAt: now(),
        retryCount: 0,
      })

      const patchedWorkout = patchExerciseInWorkout(workoutSnapshot, payload.exerciseId, payload)
      snapshotStore.upsert(patchedWorkout)
      return patchedWorkout
    }

    await request<{ message: string }>(
      `/api/workouts/${payload.workoutId}/exercises/${payload.exerciseId}`,
      {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          description: payload.description,
          exerciseType: payload.exerciseType,
          numSets: payload.numSets,
          numReps: payload.numReps,
          weightDescription: payload.weightDescription,
          durationMinutes: payload.durationMinutes,
          speedMph: payload.speedMph,
          notes: payload.notes,
        }),
      },
    )

    return await request<WorkoutDetails>(`/api/workouts/${payload.workoutId}`)
  },

  async deleteExercise(
    workoutId: number,
    exerciseId: number,
    workoutSnapshot?: WorkoutDetails,
  ): Promise<WorkoutDetails> {
    if (!isOnline() && workoutSnapshot) {
      pendingStore.enqueue({
        operationId: createId(),
        deviceId: getDeviceId(),
        entityType: 'exercise',
        action: 'delete',
        payload: {
          workoutId,
          workoutClientId: workoutSnapshot.clientId,
          exerciseId,
        },
        createdAt: now(),
        retryCount: 0,
      })

      const patchedWorkout = {
        ...markWorkoutPending(workoutSnapshot),
        exercises: workoutSnapshot.exercises.filter((exercise) => exercise.id !== exerciseId),
      }
      snapshotStore.upsert(patchedWorkout)
      return patchedWorkout
    }

    await request<{ message: string }>(`/api/workouts/${workoutId}/exercises/${exerciseId}`, {
      method: 'DELETE',
    })

    return await request<WorkoutDetails>(`/api/workouts/${workoutId}`)
  },

    async createWorkoutWithExercise(
      workout: WorkoutCreateInput,
      exercise: ExerciseInput,
    ): Promise<WorkoutDetails> {
      if (!isOnline()) {
        const workoutClientId = createId()
        const exerciseClientId = createId()
        const createdAt = now()

        pendingStore.enqueue({
          operationId: createId(),
          deviceId: getDeviceId(),
          entityType: 'workout',
          action: 'create',
          payload: {
            clientId: workoutClientId,
            name: workout.name,
            date: workout.date,
            exercise: {
              clientId: exerciseClientId,
              ...exercise,
            },
          },
          createdAt,
          retryCount: 0,
        })

        const draft = {
          ...buildPendingWorkoutDraft(workout, workoutClientId, createdAt),
          exercises: [buildPendingExerciseDraft(exercise, exerciseClientId)],
        }
        snapshotStore.upsert(draft)
        return draft
      }

      return await request<WorkoutDetails>('/api/workouts/with-first-exercise', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ ...workout, exercise }),
      })
    },
  }
}

export const api = createApiClient()
