export interface SessionUser {
  username: string
}

export type GdprAuditEvent =
  | 'gdpr_consent_recorded'
  | 'account_exported'
  | 'account_deleted'
  | 'account_purged'

export interface WorkoutRow {
  id: number
  name: string
  date: string
  username: string
  numSets: number
  numReps: number
  weightDescription: string
}

export interface ExerciseRow {
  id: number
  description: string
  numSets: number | null
  numReps: number | null
  weightDescription: string | null
  workoutId: number
  exerciseType: string
  durationMinutes: number | null
  speedMph: number | null
  notes: string | null
}

export interface WorkoutDetails {
  id: number
  name: string
  date: string
  username: string
  numSets: number
  numReps: number
  weightDescription: string
  exercises: Array<{
    id: number
    description: string
    numSets: number | null
    numReps: number | null
    weightDescription: string | null
    exerciseType: string
    durationMinutes: number | null
    speedMph: number | null
    notes: string | null
  }>
}

export interface ExportExercise {
  id: number
  description: string
  exerciseType: string
  numSets: number | null
  numReps: number | null
  weightDescription: string | null
  durationMinutes: number | null
  speedMph: number | null
  notes: string | null
}

export interface ExportWorkout {
  id: number
  name: string
  date: string
  numSets: number
  numReps: number
  weightDescription: string
  exercises: ExportExercise[]
}

export interface AccountExportPayload {
  username: string
  exportedAt: string
  workouts: ExportWorkout[]
}
