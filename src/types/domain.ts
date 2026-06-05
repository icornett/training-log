export interface User {
  id: number
  username: string
}

export interface SessionUser {
  username: string
}

export interface WorkoutListItem {
  id: number
  name: string
  date: string
  username: string
  numSets: number
  numReps: number
  weightDescription: string
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
  numSets?: number
  numReps?: number
  weightDescription?: string
  durationMinutes?: number
  speedMph?: number
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
