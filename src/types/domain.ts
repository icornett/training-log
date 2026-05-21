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
}

export interface Exercise {
  id: number
  description: string
  numSets: number
  numReps: number
  weightDescription: string
}

export interface WorkoutDetails {
  id: number
  name: string
  date: string
  username: string
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
  numSets: number
  numReps: number
  weightDescription: string
}

export interface ExerciseUpdateInput extends ExerciseInput {
  workoutId: number
  exerciseId: number
}

export interface Credentials {
  username: string
  password: string
}
