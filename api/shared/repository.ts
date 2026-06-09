import bcrypt from 'bcryptjs'
import { and, count, desc, eq } from 'drizzle-orm'

import { db } from './db.js'
import { exercises, users, workouts } from './schema.js'
import type { ExerciseRow, WorkoutDetails, WorkoutRow } from './types.js'

const normalizeExerciseRow = (
  row: Omit<ExerciseRow, 'durationMinutes' | 'speedMph'> & {
    durationMinutes: number | string | null
    speedMph: number | string | null
  },
): ExerciseRow => ({
  ...row,
  durationMinutes: row.durationMinutes === null ? null : Number(row.durationMinutes),
  speedMph: row.speedMph === null ? null : Number(row.speedMph),
})

export const uniqueUsernames = async (): Promise<string[]> => {
  const rows = await db.select({ username: users.username }).from(users)
  return rows.map((r) => r.username)
}

export const findUserIdByUsername = async (username: string): Promise<number | null> => {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  return rows.length > 0 ? rows[0].id : null
}

export const userExists = async (username: string): Promise<boolean> => {
  return (await findUserIdByUsername(username)) !== null
}

export const addUser = async (username: string, password: string): Promise<void> => {
  const hashed = await bcrypt.hash(password, 12)
  await db.insert(users).values({ username, password: hashed })
}

export const validLoginCredentials = async (username: string, password: string): Promise<boolean> => {
  const rows = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  if (rows.length === 0) {
    return false
  }
  return bcrypt.compare(password, rows[0].password)
}

export const countWorkoutsByUsername = async (username: string): Promise<number> => {
  const rows = await db
    .select({ count: count(workouts.id) })
    .from(workouts)
    .innerJoin(users, eq(workouts.userId, users.id))
    .where(eq(users.username, username))
  return Number(rows[0].count)
}

export const listWorkoutsByUsername = async (username: string, offset: number): Promise<WorkoutRow[]> => {
  return db
    .select({
      id: workouts.id,
      name: workouts.name,
      date: workouts.date,
      username: users.username,
      numSets: workouts.numSets,
      numReps: workouts.numReps,
      weightDescription: workouts.weightDescription,
    })
    .from(workouts)
    .innerJoin(users, eq(workouts.userId, users.id))
    .where(eq(users.username, username))
    .orderBy(desc(workouts.date))
    .limit(10)
    .offset(offset)
}

export const getWorkoutDetailsForUser = async (
  workoutId: number,
  username: string,
): Promise<WorkoutRow | null> => {
  const rows = await db
    .select({
      id: workouts.id,
      name: workouts.name,
      date: workouts.date,
      username: users.username,
      numSets: workouts.numSets,
      numReps: workouts.numReps,
      weightDescription: workouts.weightDescription,
    })
    .from(workouts)
    .innerJoin(users, eq(workouts.userId, users.id))
    .where(and(eq(workouts.id, workoutId), eq(users.username, username)))
    .limit(1)
  return rows.length > 0 ? rows[0] : null
}

export const listExercises = async (workoutId: number): Promise<ExerciseRow[]> => {
  const rows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.workoutId, workoutId))
    .orderBy(exercises.description)
  return rows.map(normalizeExerciseRow)
}

export const getWorkoutWithExercisesForUser = async (
  workoutId: number,
  username: string,
): Promise<WorkoutDetails | null> => {
  const workout = await getWorkoutDetailsForUser(workoutId, username)
  if (!workout) {
    return null
  }

  const exerciseRows = await listExercises(workoutId)

  return {
    id: workout.id,
    name: workout.name,
    date: workout.date,
    username: workout.username,
    numSets: workout.numSets,
    numReps: workout.numReps,
    weightDescription: workout.weightDescription,
    exercises: exerciseRows.map((e) => ({
      id: e.id,
      description: e.description,
      numSets: e.numSets,
      numReps: e.numReps,
      weightDescription: e.weightDescription,
      exerciseType: e.exerciseType,
      durationMinutes: e.durationMinutes,
      speedMph: e.speedMph,
      notes: e.notes,
    })),
  }
}

export const addWorkout = async (
  name: string,
  date: string,
  numSets: number,
  numReps: number,
  weightDescription: string,
  userId: number,
): Promise<number> => {
  const rows = await db
    .insert(workouts)
    .values({ name, date, numSets, numReps, weightDescription, userId })
    .returning({ id: workouts.id })
  return rows[0].id
}

export const updateWorkout = async (id: number, name: string, date: string): Promise<void> => {
  await db.update(workouts).set({ name, date }).where(eq(workouts.id, id))
}

export const addWorkoutWithExercise = async (
  userId: number,
  workoutName: string,
  workoutDate: string,
  exercise: {
    description: string
    numSets: number | null
    numReps: number | null
    weightDescription: string | null
    exerciseType: string
    durationMinutes: number | null
    speedMph: number | null
    notes: string | null
  },
): Promise<{ workoutId: number; exerciseId: number }> => {
  return db.transaction(async (tx) => {
    const [workout] = await tx
      .insert(workouts)
      .values({ name: workoutName, date: workoutDate, numSets: 0, numReps: 0, weightDescription: 'bodyweight', userId })
      .returning({ id: workouts.id })

    const [exerciseRow] = await tx
      .insert(exercises)
      .values({
        description: exercise.description,
        numSets: exercise.numSets,
        numReps: exercise.numReps,
        weightDescription: exercise.weightDescription,
        workoutId: workout.id,
        exerciseType: exercise.exerciseType,
        durationMinutes: exercise.durationMinutes,
        speedMph: exercise.speedMph,
        notes: exercise.notes,
      })
      .returning({ id: exercises.id })

    return { workoutId: workout.id, exerciseId: exerciseRow.id }
  })
}

export const deleteWorkout = async (id: number): Promise<void> => {
  await db.delete(workouts).where(eq(workouts.id, id))
}

export const getExerciseById = async (exerciseId: number): Promise<ExerciseRow | null> => {
  const rows = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1)
  return rows.length > 0 ? rows[0] : null
}

export const getExerciseForWorkout = async (
  workoutId: number,
  exerciseId: number,
): Promise<ExerciseRow | null> => {
  const rows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.workoutId, workoutId), eq(exercises.id, exerciseId)))
    .limit(1)

  const row = rows.length > 0 ? rows[0] : null
  if (!row) return null

  return {
    ...row,
    durationMinutes: row.durationMinutes !== null ? Number(row.durationMinutes) : null,
    speedMph: row.speedMph !== null ? Number(row.speedMph) : null,
  }
}

export const addExercise = async (
  workoutId: number,
  description: string,
  numSets: number | null,
  numReps: number | null,
  weightDescription: string | null,
  exerciseType: string,
  durationMinutes: number | null,
  speedMph: number | null,
  notes: string | null,
): Promise<number> => {
  const rows = await db
    .insert(exercises)
    .values({ workoutId, description, numSets, numReps, weightDescription, exerciseType, durationMinutes, speedMph, notes })
    .returning({ id: exercises.id })
  return rows[0].id
}

export const updateExercise = async (
  exerciseId: number,
  description: string,
  numSets: number | null,
  numReps: number | null,
  weightDescription: string | null,
  exerciseType: string,
  durationMinutes: number | null,
  speedMph: number | null,
  notes: string | null,
): Promise<void> => {
  await db
    .update(exercises)
    .set({ description, numSets, numReps, weightDescription, exerciseType, durationMinutes, speedMph, notes })
    .where(eq(exercises.id, exerciseId))
}

export const deleteExercise = async (exerciseId: number): Promise<void> => {
  await db.delete(exercises).where(eq(exercises.id, exerciseId))
}

export const deleteUserByUsername = async (username: string): Promise<void> => {
  const userId = await findUserIdByUsername(username)
  if (userId === null) {
    return
  }
  await db.delete(users).where(eq(users.id, userId))
}

export const atExerciseLimit = async (workoutId: number): Promise<boolean> => {
  const rows = await db
    .select({ count: count(exercises.id) })
    .from(exercises)
    .where(eq(exercises.workoutId, workoutId))
  return Number(rows[0].count) === 10
}

export const normalizedExerciseDescriptionsByWorkout = async (workoutId: number): Promise<string[]> => {
  const rows = await listExercises(workoutId)
  return rows.map((e) => e.description.toLowerCase().replace(/\s+/g, ''))
}

export const workoutExists = async (workoutId: number): Promise<boolean> => {
  const rows = await db.select({ id: workouts.id }).from(workouts).where(eq(workouts.id, workoutId)).limit(1)
  return rows.length > 0
}

export const exerciseExists = async (exerciseId: number): Promise<boolean> => {
  return (await getExerciseById(exerciseId)) !== null
}
