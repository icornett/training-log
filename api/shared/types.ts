export interface SessionUser {
  username: string
}

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
