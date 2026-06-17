import type { ConflictPayload, PendingOperation, WorkoutDetails } from '../types/domain'

const pendingOperationsKey = 'trainingLog:pendingOperations'
const workoutSnapshotsKey = 'trainingLog:workoutSnapshots'
const syncConflictsKey = 'trainingLog:syncConflicts'

export const syncStatusChangedEventName = 'trainingLog:sync-status-changed'

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface PendingOperationStore {
  list: () => PendingOperation[]
  enqueue: (operation: PendingOperation) => void
  remove: (operationId: string) => void
}

export interface WorkoutSnapshotStore {
  list: () => WorkoutDetails[]
  get: (id: number) => WorkoutDetails | null
  upsert: (workout: WorkoutDetails) => void
  remove: (id: number) => void
}

export interface ConflictStore {
  list: () => ConflictPayload[]
  upsert: (conflict: ConflictPayload) => void
  remove: (operationId: string) => void
  clear: () => void
}

const readPendingOperations = (storage: StorageLike): PendingOperation[] => {
  const serialized = storage.getItem(pendingOperationsKey)
  if (!serialized) {
    return []
  }

  try {
    const parsed = JSON.parse(serialized) as PendingOperation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const readArray = <T>(storage: StorageLike, key: string): T[] => {
  const serialized = storage.getItem(key)
  if (!serialized) {
    return []
  }

  try {
    const parsed = JSON.parse(serialized) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const emitSyncStatusChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(syncStatusChangedEventName))
  }
}

const writeArray = <T>(storage: StorageLike, key: string, values: T[]): void => {
  storage.setItem(key, JSON.stringify(values))

  emitSyncStatusChanged()
}

const writePendingOperations = (storage: StorageLike, operations: PendingOperation[]): void => {
  writeArray(storage, pendingOperationsKey, operations)
}

const writeWorkoutSnapshots = (storage: StorageLike, workouts: WorkoutDetails[]): void => {
  writeArray(storage, workoutSnapshotsKey, workouts)
}

const writeConflicts = (storage: StorageLike, conflicts: ConflictPayload[]): void => {
  writeArray(storage, syncConflictsKey, conflicts)
}

const upsertBy = <T>(items: T[], matcher: (item: T) => boolean, nextItem: T): T[] => {
  const index = items.findIndex(matcher)
  if (index === -1) {
    return [...items, nextItem]
  }

  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item))
}

export const createPendingOperationStore = (storage: StorageLike): PendingOperationStore => {
  return {
    list(): PendingOperation[] {
      return readPendingOperations(storage)
    },

    enqueue(operation: PendingOperation): void {
      const operations = readPendingOperations(storage)
      writePendingOperations(storage, [...operations, operation])
    },

    remove(operationId: string): void {
      const operations = readPendingOperations(storage).filter(
        (operation) => operation.operationId !== operationId,
      )
      writePendingOperations(storage, operations)
    },
  }
}

export const createWorkoutSnapshotStore = (storage: StorageLike): WorkoutSnapshotStore => {
  return {
    list(): WorkoutDetails[] {
      return readArray<WorkoutDetails>(storage, workoutSnapshotsKey)
    },

    get(id: number): WorkoutDetails | null {
      return readArray<WorkoutDetails>(storage, workoutSnapshotsKey).find((workout) => workout.id === id) ?? null
    },

    upsert(workout: WorkoutDetails): void {
      const workouts = readArray<WorkoutDetails>(storage, workoutSnapshotsKey)
      writeWorkoutSnapshots(storage, upsertBy(workouts, (item) => item.id === workout.id, workout))
    },

    remove(id: number): void {
      const workouts = readArray<WorkoutDetails>(storage, workoutSnapshotsKey).filter(
        (workout) => workout.id !== id,
      )
      writeWorkoutSnapshots(storage, workouts)
    },
  }
}

export const createConflictStore = (storage: StorageLike): ConflictStore => {
  return {
    list(): ConflictPayload[] {
      return readArray<ConflictPayload>(storage, syncConflictsKey)
    },

    upsert(conflict: ConflictPayload): void {
      const conflicts = readArray<ConflictPayload>(storage, syncConflictsKey)
      writeConflicts(
        storage,
        upsertBy(conflicts, (item) => item.operationId === conflict.operationId, conflict),
      )
    },

    remove(operationId: string): void {
      const conflicts = readArray<ConflictPayload>(storage, syncConflictsKey).filter(
        (conflict) => conflict.operationId !== operationId,
      )
      writeConflicts(storage, conflicts)
    },

    clear(): void {
      writeConflicts(storage, [])
    },
  }
}