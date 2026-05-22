import bcrypt from 'bcryptjs'

import { query } from './db.js'
import type { ExerciseRow, WorkoutDetails, WorkoutRow } from './types.js'

export const uniqueUsernames = async (): Promise<string[]> => {
  const sql = 'SELECT username FROM users GROUP BY username;'
  const result = await query<{ username: string }>(sql)
  return result.rows.map((row: { username: string }) => row.username)
}

export const findUserIdByUsername = async (username: string): Promise<number | null> => {
  const sql = 'SELECT id FROM users WHERE username = $1;'
  const result = await query<{ id: number }>(sql, [username])
  return result.rows.length > 0 ? Number(result.rows[0].id) : null
}

export const userExists = async (username: string): Promise<boolean> => {
  return (await findUserIdByUsername(username)) !== null
}

export const addUser = async (username: string, password: string): Promise<void> => {
  const hashed = await bcrypt.hash(password, 12)
  await query('INSERT INTO users (username, password) VALUES ($1, $2);', [username, hashed])
}

export const validLoginCredentials = async (username: string, password: string): Promise<boolean> => {
  const result = await query<{ password: string }>('SELECT password FROM users WHERE username = $1;', [username])
  if (result.rows.length === 0) {
    return false
  }

  return bcrypt.compare(password, result.rows[0].password)
}

export const countWorkoutsByUsername = async (username: string): Promise<number> => {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(w.id)
      FROM workouts w
      JOIN users u ON w.user_id = u.id
      WHERE u.username = $1;
    `,
    [username],
  )

  return Number(result.rows[0].count)
}

export const listWorkoutsByUsername = async (username: string, offset: number): Promise<WorkoutRow[]> => {
  const sql = `
    SELECT
      w.id,
      w.name,
      w.date::text AS date,
      u.username,
      w.num_sets AS "numSets",
      w.num_reps AS "numReps",
      w.weight_description AS "weightDescription"
    FROM workouts w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = $1
    ORDER BY w.date DESC
    LIMIT 10 OFFSET $2;
  `

  const result = await query<WorkoutRow>(sql, [username, offset])
  return result.rows.map((row: WorkoutRow) => ({
    ...row,
    id: Number(row.id),
    numSets: Number(row.numSets),
    numReps: Number(row.numReps),
  }))
}

export const getWorkoutDetailsForUser = async (
  workoutId: number,
  username: string,
): Promise<WorkoutRow | null> => {
  const sql = `
    SELECT
      w.id,
      w.name,
      w.date::text AS date,
      u.username,
      w.num_sets AS "numSets",
      w.num_reps AS "numReps",
      w.weight_description AS "weightDescription"
    FROM workouts w
    JOIN users u ON w.user_id = u.id
    WHERE w.id = $1 AND u.username = $2;
  `

  const result = await query<WorkoutRow>(sql, [workoutId, username])
  if (result.rows.length === 0) {
    return null
  }

  const workout = result.rows[0]
  return {
    ...workout,
    id: Number(workout.id),
    numSets: Number(workout.numSets),
    numReps: Number(workout.numReps),
  }
}

export const listExercises = async (workoutId: number): Promise<ExerciseRow[]> => {
  const sql = `
    SELECT id, description, num_sets, num_reps, weight_description
    FROM exercises
    WHERE workout_id = $1
    ORDER BY description;
  `

  const result = await query<ExerciseRow>(sql, [workoutId])
  return result.rows.map((row: ExerciseRow) => ({
    ...row,
    id: Number(row.id),
    num_sets: Number(row.num_sets),
    num_reps: Number(row.num_reps),
  }))
}

export const getWorkoutWithExercisesForUser = async (
  workoutId: number,
  username: string,
): Promise<WorkoutDetails | null> => {
  const workout = await getWorkoutDetailsForUser(workoutId, username)
  if (!workout) {
    return null
  }

  const exercises = await listExercises(workoutId)

  return {
    id: workout.id,
    name: workout.name,
    date: workout.date,
    username: workout.username,
    numSets: workout.numSets,
    numReps: workout.numReps,
    weightDescription: workout.weightDescription,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      description: exercise.description,
      numSets: exercise.num_sets,
      numReps: exercise.num_reps,
      weightDescription: exercise.weight_description,
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
  const result = await query<{ id: number }>(
    'INSERT INTO workouts (name, "date", num_sets, num_reps, weight_description, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;',
    [name, date, numSets, numReps, weightDescription, userId],
  )

  return Number(result.rows[0].id)
}

export const updateWorkout = async (
  id: number,
  name: string,
  date: string,
  numSets: number,
  numReps: number,
  weightDescription: string,
): Promise<void> => {
  await query(
    'UPDATE workouts SET name = $1, "date" = $2, num_sets = $3, num_reps = $4, weight_description = $5 WHERE id = $6;',
    [name, date, numSets, numReps, weightDescription, id],
  )
}

export const deleteWorkout = async (id: number): Promise<void> => {
  await query('DELETE FROM workouts WHERE id = $1;', [id])
}

export const getExerciseById = async (exerciseId: number): Promise<ExerciseRow | null> => {
  const sql = `
    SELECT id, description, num_sets, num_reps, weight_description
    FROM exercises
    WHERE id = $1;
  `
  const result = await query<ExerciseRow>(sql, [exerciseId])
  return result.rows.length > 0 ? result.rows[0] : null
}

export const getExerciseForWorkout = async (
  workoutId: number,
  exerciseId: number,
): Promise<ExerciseRow | null> => {
  const sql = `
    SELECT id, description, num_sets, num_reps, weight_description
    FROM exercises
    WHERE workout_id = $1 AND id = $2;
  `

  const result = await query<ExerciseRow>(sql, [workoutId, exerciseId])
  return result.rows.length > 0 ? result.rows[0] : null
}

export const addExercise = async (
  workoutId: number,
  description: string,
  numSets: number,
  numReps: number,
  weightDescription: string,
): Promise<number> => {
  const sql = `
    INSERT INTO exercises (description, num_sets, num_reps, weight_description, workout_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `

  const result = await query<{ id: number }>(sql, [description, numSets, numReps, weightDescription, workoutId])
  return Number(result.rows[0].id)
}

export const updateExercise = async (
  exerciseId: number,
  description: string,
  numSets: number,
  numReps: number,
  weightDescription: string,
): Promise<void> => {
  const sql = `
    UPDATE exercises
    SET description = $1,
        num_sets = $2,
        num_reps = $3,
        weight_description = $4
    WHERE id = $5;
  `

  await query(sql, [description, numSets, numReps, weightDescription, exerciseId])
}

export const deleteExercise = async (exerciseId: number): Promise<void> => {
  await query('DELETE FROM exercises WHERE id = $1;', [exerciseId])
}

export const deleteUserByUsername = async (username: string): Promise<void> => {
  const userId = await findUserIdByUsername(username)
  if (userId === null) {
    return
  }

  await query('DELETE FROM users WHERE id = $1;', [userId])
}

export const atExerciseLimit = async (workoutId: number): Promise<boolean> => {
  const result = await query<{ count: string }>('SELECT COUNT(workout_id) FROM exercises WHERE workout_id = $1;', [
    workoutId,
  ])

  return Number(result.rows[0].count) === 10
}

export const normalizedExerciseDescriptionsByWorkout = async (workoutId: number): Promise<string[]> => {
  const exercises = await listExercises(workoutId)
  return exercises.map((exercise) => exercise.description.toLowerCase().replace(/\s+/g, ''))
}

export const workoutExists = async (workoutId: number): Promise<boolean> => {
  const result = await query<{ id: number }>('SELECT id FROM workouts WHERE id = $1;', [workoutId])
  return result.rows.length > 0
}

export const exerciseExists = async (exerciseId: number): Promise<boolean> => {
  return (await getExerciseById(exerciseId)) !== null
}
