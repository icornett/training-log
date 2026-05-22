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
  num_sets: number
  num_reps: number
  weight_description: string
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
    numSets: number
    numReps: number
    weightDescription: string
  }>
}
