import type { ConflictPayload, PendingOperation, WorkoutDetails } from '../types/domain'
import {
  createConflictStore,
  createPendingOperationStore,
  createWorkoutSnapshotStore,
  type ConflictStore,
  type PendingOperationStore,
  type WorkoutSnapshotStore,
} from './localStore'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

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
  (fetchFn: typeof fetch) =>
  async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetchFn(path, {
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

const createFallbackSnapshotStore = (): WorkoutSnapshotStore => ({
  list: () => [],
  get: () => null,
  upsert: () => undefined,
  remove: () => undefined,
})

const createFallbackConflictStore = (): ConflictStore => ({
  list: () => [],
  upsert: () => undefined,
  remove: () => undefined,
  clear: () => undefined,
})

const getPendingStore = (): PendingOperationStore => {
  const storage = getBrowserStorage()
  return storage ? createPendingOperationStore(storage) : createFallbackPendingStore()
}

const getSnapshotStore = (): WorkoutSnapshotStore => {
  const storage = getBrowserStorage()
  return storage ? createWorkoutSnapshotStore(storage) : createFallbackSnapshotStore()
}

const getConflictStore = (): ConflictStore => {
  const storage = getBrowserStorage()
  return storage ? createConflictStore(storage) : createFallbackConflictStore()
}

interface SyncServiceDeps {
  fetchFn: typeof fetch
  pendingStore: PendingOperationStore
  snapshotStore: WorkoutSnapshotStore
  conflictStore: ConflictStore
  isOnline: () => boolean
  now: () => string
}

interface FlushResult {
  processed: number
  conflicts: number
  lastError: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const markSnapshotState = (snapshot: WorkoutDetails, pendingState: 'pending' | 'conflict'): WorkoutDetails => ({
  ...snapshot,
  pendingState,
  exercises: snapshot.exercises.map((exercise) => ({
    ...exercise,
    pendingState:
      exercise.pendingState === 'conflict' || pendingState === 'conflict' ? 'conflict' : exercise.pendingState,
  })),
})

const buildConflict = (
  operation: PendingOperation,
  serverValue: Record<string, unknown>,
  detectedAt: string,
): ConflictPayload => ({
  operationId: operation.operationId,
  entityType: operation.entityType,
  serverValue,
  clientValue: operation.payload,
  detectedAt,
})

const getSnapshotIdFromPayload = (
  payload: Record<string, unknown>,
  snapshotStore: WorkoutSnapshotStore,
): number | null => {
  const workoutId = payload.workoutId
  if (typeof workoutId === 'number') {
    return workoutId
  }

  const workoutClientId = payload.workoutClientId
  if (typeof workoutClientId === 'string') {
    const match = snapshotStore.list().find((snapshot) => snapshot.clientId === workoutClientId)
    return match?.id ?? null
  }

  const clientId = payload.clientId
  if (typeof clientId === 'string') {
    const match = snapshotStore.list().find((snapshot) => snapshot.clientId === clientId)
    return match?.id ?? null
  }

  return null
}

export const createSyncService = (deps: Partial<SyncServiceDeps> = {}) => {
  const fetchFn = deps.fetchFn ?? fetch
  const request = createRequest(fetchFn)
  const pendingStore = deps.pendingStore ?? getPendingStore()
  const snapshotStore = deps.snapshotStore ?? getSnapshotStore()
  const conflictStore = deps.conflictStore ?? getConflictStore()
  const isOnline = deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const now = deps.now ?? (() => new Date().toISOString())

  const rewriteQueuedWorkoutReferences = (
    workoutClientId: string,
    nextWorkoutId: number,
    snapshotBefore: WorkoutDetails | null,
  ): void => {
    const remaining = pendingStore.list().map((operation) => {
      if (!isRecord(operation.payload)) {
        return operation
      }

      const matchesClient = operation.payload.workoutClientId === workoutClientId
      const matchesNegativeId =
        snapshotBefore !== null && typeof operation.payload.workoutId === 'number' && operation.payload.workoutId === snapshotBefore.id

      if (!matchesClient && !matchesNegativeId) {
        return operation
      }

      return {
        ...operation,
        payload: {
          ...operation.payload,
          workoutId: nextWorkoutId,
        },
      }
    })

    const unique = new Map<string, PendingOperation>()
    remaining.forEach((operation) => {
      unique.set(operation.operationId, operation)
    })

    const deduped = [...unique.values()]
    const storage = getBrowserStorage()
    if (!storage) {
      return
    }

    storage.setItem('trainingLog:pendingOperations', JSON.stringify(deduped))
    window.dispatchEvent(new Event('trainingLog:sync-status-changed'))
  }

  const resolveWorkoutId = (payload: Record<string, unknown>, workoutIdMap: Map<string, number>): number => {
    const workoutClientId = payload.workoutClientId
    if (typeof workoutClientId === 'string' && workoutIdMap.has(workoutClientId)) {
      return workoutIdMap.get(workoutClientId) as number
    }

    const workoutId = payload.workoutId
    if (typeof workoutId === 'number') {
      return workoutId
    }

    throw new Error('Missing workout reference for sync operation.')
  }

  const fetchWorkoutServerValue = async (workoutId: number): Promise<Record<string, unknown>> => {
    try {
      return await request<Record<string, unknown>>(`/api/workouts/${workoutId}`)
    } catch {
      return { workoutId }
    }
  }

  return {
    async flush(): Promise<FlushResult> {
      if (!isOnline()) {
        return { processed: 0, conflicts: 0, lastError: null }
      }

      let processed = 0
      let conflicts = 0
      let lastError: string | null = null
      const workoutIdMap = new Map<string, number>()

      for (const operation of pendingStore.list()) {
        try {
          const payload = isRecord(operation.payload) ? operation.payload : {}

          if (operation.entityType === 'workout' && operation.action === 'create') {
            const workoutClientId = typeof payload.clientId === 'string' ? payload.clientId : null
            const snapshotBefore =
              workoutClientId === null
                ? null
                : snapshotStore.list().find((snapshot) => snapshot.clientId === workoutClientId) ?? null

            if (isRecord(payload.exercise)) {
              const createdWorkout = await request<WorkoutDetails>('/api/workouts/with-first-exercise', {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                  name: payload.name,
                  date: payload.date,
                  exercise: {
                    description: payload.exercise.description,
                    exerciseType: payload.exercise.exerciseType,
                    numSets: payload.exercise.numSets,
                    numReps: payload.exercise.numReps,
                    weightDescription: payload.exercise.weightDescription,
                    durationMinutes: payload.exercise.durationMinutes,
                    speedMph: payload.exercise.speedMph,
                    notes: payload.exercise.notes,
                  },
                }),
              })

              if (workoutClientId) {
                workoutIdMap.set(workoutClientId, createdWorkout.id)
                rewriteQueuedWorkoutReferences(workoutClientId, createdWorkout.id, snapshotBefore)
              }
            } else {
              const created = await request<{ id: number; message: string }>('/api/workouts', {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                  name: payload.name,
                  date: payload.date,
                }),
              })

              if (workoutClientId) {
                workoutIdMap.set(workoutClientId, created.id)
                rewriteQueuedWorkoutReferences(workoutClientId, created.id, snapshotBefore)
              }
            }

            pendingStore.remove(operation.operationId)
            conflictStore.remove(operation.operationId)
            if (snapshotBefore) {
              snapshotStore.remove(snapshotBefore.id)
            }
            processed += 1
            continue
          }

          if (operation.entityType === 'exercise' && operation.action === 'create') {
            const workoutId = resolveWorkoutId(payload, workoutIdMap)
            await request<{ id: number; message: string }>(`/api/workouts/${workoutId}/exercises`, {
              method: 'POST',
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
            })
            await request<WorkoutDetails>(`/api/workouts/${workoutId}`)

            pendingStore.remove(operation.operationId)
            conflictStore.remove(operation.operationId)
            const snapshotId = getSnapshotIdFromPayload(payload, snapshotStore)
            if (snapshotId !== null) {
              snapshotStore.remove(snapshotId)
            }
            processed += 1
            continue
          }

          if (operation.entityType === 'exercise' && operation.action === 'update') {
            const workoutId = resolveWorkoutId(payload, workoutIdMap)
            await request<{ message: string }>(`/api/workouts/${workoutId}/exercises/${payload.exerciseId}`, {
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
            })
            await request<WorkoutDetails>(`/api/workouts/${workoutId}`)

            pendingStore.remove(operation.operationId)
            conflictStore.remove(operation.operationId)
            const snapshotId = getSnapshotIdFromPayload(payload, snapshotStore)
            if (snapshotId !== null) {
              snapshotStore.remove(snapshotId)
            }
            processed += 1
            continue
          }

          if (operation.entityType === 'exercise' && operation.action === 'delete') {
            const workoutId = resolveWorkoutId(payload, workoutIdMap)
            await request<{ message: string }>(`/api/workouts/${workoutId}/exercises/${payload.exerciseId}`, {
              method: 'DELETE',
            })
            await request<WorkoutDetails>(`/api/workouts/${workoutId}`)

            pendingStore.remove(operation.operationId)
            conflictStore.remove(operation.operationId)
            const snapshotId = getSnapshotIdFromPayload(payload, snapshotStore)
            if (snapshotId !== null) {
              snapshotStore.remove(snapshotId)
            }
            processed += 1
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unable to sync offline changes.'
          conflicts += 1

          const payload = isRecord(operation.payload) ? operation.payload : {}
          const workoutId = typeof payload.workoutId === 'number' ? payload.workoutId : null
          const serverValue = workoutId === null ? {} : await fetchWorkoutServerValue(workoutId)
          conflictStore.upsert(buildConflict(operation, serverValue, now()))

          const snapshotId = getSnapshotIdFromPayload(payload, snapshotStore)
          if (snapshotId !== null) {
            const snapshot = snapshotStore.get(snapshotId)
            if (snapshot) {
              snapshotStore.upsert(markSnapshotState(snapshot, 'conflict'))
            }
          }
        }
      }

      return { processed, conflicts, lastError }
    },
  }
}

export const syncService = createSyncService()
