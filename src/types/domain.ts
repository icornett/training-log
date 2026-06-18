export interface User {
  id: number
  username: string
}

export interface SessionUser {
  username: string
}

export type SyncState = 'synced' | 'pending' | 'conflict'

export type PendingEntityType = 'workout' | 'exercise'

export type PendingOperationAction = 'create' | 'update' | 'delete'

export interface PendingOperation {
  operationId: string
  deviceId: string
  entityType: PendingEntityType
  action: PendingOperationAction
  payload: Record<string, unknown>
  createdAt: string
  retryCount: number
}

export interface ConflictPayload {
  operationId: string
  entityType: PendingEntityType
  serverValue: Record<string, unknown>
  clientValue: Record<string, unknown>
  detectedAt: string
}

export interface WorkoutListItem {
  id: number
  name: string
  date: string
  username: string
  numSets: number
  numReps: number
  weightDescription: string
  clientId?: string
  lastSyncedAt?: string | null
  pendingState?: SyncState
}

export interface Exercise {
  id: number
  description: string
  exerciseType: 'strength' | 'cardio'
  numSets: number | null
  numReps: number | null
  weightDescription: string | null
  durationMinutes: number | null
  speedMph: number | null
  notes: string | null
  clientId?: string
  lastSyncedAt?: string | null
  pendingState?: SyncState
}

export interface WorkoutDetails {
  id: number
  name: string
  date: string
  username: string
  numSets: number
  numReps: number
  weightDescription: string
  exercises: Exercise[]
  clientId?: string
  lastSyncedAt?: string | null
  pendingState?: SyncState
}

export interface WorkoutCreateInput {
  name: string
  date: string
}

export interface WorkoutUpdateInput {
  id: number
  name: string
  date: string
}

export interface ExerciseInput {
  description: string
  exerciseType: 'strength' | 'cardio'
  speedUnit?: 'mph' | 'kmh'
  numSets?: number
  numReps?: number
  weightDescription?: string
  durationMinutes?: number
  speedMph?: number
  speedKph?: number
  notes?: string
}

export interface ExerciseUpdateInput extends ExerciseInput {
  workoutId: number
  exerciseId: number
}

export interface Credentials {
  username: string
  password: string
}

export interface SignupCredentials extends Credentials {
  gdprConsentAccepted: boolean
}

export interface AccountExportData {
  username: string
  exportedAt: string
  workouts: Array<{
    id: number
    name: string
    date: string
    numSets: number
    numReps: number
    weightDescription: string
    exercises: Exercise[]
  }>
}
