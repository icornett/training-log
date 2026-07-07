export interface SessionUser {
  username: string
  favoriteTeamKey?: string | null
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

/**
 * A single data point in an exercise's progress time series.
 * Represents one occurrence of an exercise in a historical workout.
 */
export interface ExerciseProgressPoint {
  /** Source workout ID, for future reference back to full workout details */
  workoutId: number
  /** Workout date (ISO 8601 calendar date, no time component) */
  workoutDate: string
  /** Normalized exercise description for grouping */
  exerciseDescription: string
  /** Number of sets performed; null if not recorded */
  numSets: number | null
  /** Number of reps per set; null if not recorded */
  numReps: number | null
  /** Weight description (e.g., 'bodyweight', '135 lbs'); null if not recorded */
  weightDescription: string | null
  /** Duration in minutes (for cardio exercises); null for strength or if not recorded */
  durationMinutes: number | null
  /** Speed in mph (for cardio exercises); null for strength or if not recorded */
  speedMph: number | null
}

/**
 * Lightweight summary metadata for an exercise's progress history.
 * Used to populate exercise dropdowns and overview information.
 */
export interface ExerciseProgressSummary {
  /** Normalized exercise description */
  exerciseDescription: string
  /** First date this exercise was recorded (ISO 8601 calendar date) */
  firstSeenDate: string
  /** Most recent date this exercise was recorded (ISO 8601 calendar date) */
  lastSeenDate: string
  /** Number of times this exercise has been performed */
  totalOccurrences: number
}
