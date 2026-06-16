import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import initSqlJs, { type Database } from 'sql.js'
import type { Page, Route } from '@playwright/test'

const pageSize = 10

interface MockApiOptions {
  authenticatedAs?: string | null
}

const asRows = <T extends Record<string, unknown>>(result: {
  columns: string[]
  values: unknown[][]
} | null): T[] => {
  if (!result) {
    return []
  }

  return result.values.map((valueRow) => {
    const row: Record<string, unknown> = {}
    result.columns.forEach((column, index) => {
      row[column] = valueRow[index]
    })
    return row as T
  })
}

const esc = (value: string): string => value.replace(/'/g, "''")

const toWorkoutDetails = (db: Database, workoutId: number): Record<string, unknown> | null => {
  const workoutResult = db.exec(
    `SELECT
       id,
       name,
       date,
       username,
       num_sets AS numSets,
       num_reps AS numReps,
       weight_description AS weightDescription
     FROM workouts
     WHERE id = ${workoutId}
     LIMIT 1;`,
  )[0] ?? null

  const workout = asRows<Record<string, unknown>>(workoutResult)[0]
  if (!workout) {
    return null
  }

  const exercisesResult = db.exec(
    `SELECT
       id,
       description,
       exercise_type AS exerciseType,
       num_sets AS numSets,
       num_reps AS numReps,
       weight_description AS weightDescription,
       duration_minutes AS durationMinutes,
       speed_mph AS speedMph,
       notes
     FROM exercises
     WHERE workout_id = ${workoutId}
     ORDER BY description ASC;`,
  )[0] ?? null

  return {
    ...workout,
    exercises: asRows(exercisesResult),
  }
}

export const setupSqliteMockApi = async (page: Page, options: MockApiOptions = {}): Promise<void> => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  let sessionUser: string | null = options.authenticatedAs === undefined ? 'Playwright User' : options.authenticatedAs

  const seedSqlPath = join(process.cwd(), 'tests/e2e/seed/playwright-seed.sql')
  const seedSql = readFileSync(seedSqlPath, 'utf8')
  db.run(seedSql)

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()

    const body = (() => {
      try {
        return route.request().postDataJSON() as Record<string, unknown>
      } catch {
        return {}
      }
    })()

    const json = async (status: number, payload: unknown): Promise<void> => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      })
    }

    const requireSession = async (): Promise<boolean> => {
      if (!sessionUser) {
        await json(401, { error: 'Please login to access the Training Log App.' })
        return false
      }

      return true
    }

    if (method === 'POST' && url.pathname === '/api/signup') {
      const username = String(body.username ?? '').trim()
      const password = String(body.password ?? '')
      const gdprConsentAccepted = body.gdprConsentAccepted === true

      if (!gdprConsentAccepted) {
        await json(422, { error: 'You must accept the privacy notice to create an account.' })
        return
      }

      if (username.length === 0 || password.length < 10) {
        await json(422, { error: 'Please enter a unique username and a password with at least 10 characters.' })
        return
      }

      const existing = db.exec(
        `SELECT id FROM users WHERE username = '${esc(username)}' LIMIT 1;`,
      )[0] ?? null
      if (asRows(existing).length > 0) {
        await json(422, { error: 'Username already exists.' })
        return
      }

      const maxIdResult = db.exec('SELECT COALESCE(MAX(id), 0) AS maxId FROM users;')[0] ?? null
      const maxId = Number(asRows<{ maxId: number }>(maxIdResult)[0]?.maxId ?? 0)
      db.run(
        `INSERT INTO users (id, username, password) VALUES (${maxId + 1}, '${esc(username)}', '${esc(password)}');`,
      )
      sessionUser = username
      await json(201, { ok: true, username })
      return
    }

    if (method === 'POST' && url.pathname === '/api/login') {
      const username = String(body.username ?? '').trim()
      const password = String(body.password ?? '')
      const loginResult = db.exec(
        `SELECT username, password FROM users WHERE username = '${esc(username)}' LIMIT 1;`,
      )[0] ?? null
      const user = asRows<{ username: string; password: string }>(loginResult)[0]

      if (!user || user.password !== password) {
        await json(422, { error: 'Incorrect login credentials. Please try again.' })
        return
      }

      sessionUser = user.username
      await json(200, { ok: true, username: user.username })
      return
    }

    if (method === 'POST' && url.pathname === '/api/logout') {
      sessionUser = null
      await json(200, { ok: true })
      return
    }

    if (method === 'POST' && url.pathname === '/api/workouts/with-first-exercise') {
      if (!(await requireSession())) {
        return
      }

      const name = String(body.name ?? '').trim()
      const date = String(body.date ?? '')
      const exercise = (body.exercise ?? {}) as Record<string, unknown>

      if (name.length < 4 || name.length > 15) {
        await json(422, { error: 'Invalid workout entry.' })
        return
      }

      const duplicateResult = db.exec(
        `SELECT id FROM workouts WHERE username = '${esc(sessionUser ?? '')}' AND date = '${esc(date)}' LIMIT 1;`,
      )[0] ?? null
      if (asRows(duplicateResult).length > 0) {
        await json(422, { error: 'Invalid workout entry.' })
        return
      }

      const maxWorkoutIdResult = db.exec('SELECT COALESCE(MAX(id), 0) AS maxId FROM workouts;')[0] ?? null
      const maxWorkoutId = Number(asRows<{ maxId: number }>(maxWorkoutIdResult)[0]?.maxId ?? 0)
      const workoutId = maxWorkoutId + 1

      db.run(
        `INSERT INTO workouts (id, name, date, username, num_sets, num_reps, weight_description)
         VALUES (${workoutId}, '${esc(name)}', '${esc(date)}', '${esc(sessionUser ?? '')}', 1, 1, 'bodyweight');`,
      )

      const maxExerciseIdResult = db.exec('SELECT COALESCE(MAX(id), 0) AS maxId FROM exercises;')[0] ?? null
      const maxExerciseId = Number(asRows<{ maxId: number }>(maxExerciseIdResult)[0]?.maxId ?? 0)
      const exerciseId = maxExerciseId + 1

      const exerciseType = String(exercise.exerciseType ?? 'strength')
      const numSets = exercise.numSets !== undefined ? Number(exercise.numSets) : null
      const numReps = exercise.numReps !== undefined ? Number(exercise.numReps) : null
      const weightDescription =
        exercise.weightDescription !== undefined ? String(exercise.weightDescription) : null
      const durationMinutes = exercise.durationMinutes !== undefined ? Number(exercise.durationMinutes) : null
      const speedMph = exercise.speedMph !== undefined ? Number(exercise.speedMph) : null
      const notes = exercise.notes !== undefined ? String(exercise.notes) : null

      db.run(
        `INSERT INTO exercises (id, workout_id, description, exercise_type, num_sets, num_reps, weight_description, duration_minutes, speed_mph, notes)
         VALUES (${exerciseId}, ${workoutId}, '${esc(String(exercise.description ?? ''))}', '${esc(exerciseType)}',
           ${numSets === null ? 'NULL' : numSets}, ${numReps === null ? 'NULL' : numReps},
           ${weightDescription === null ? 'NULL' : `'${esc(weightDescription)}'`},
           ${durationMinutes === null ? 'NULL' : durationMinutes},
           ${speedMph === null ? 'NULL' : speedMph},
           ${notes === null ? 'NULL' : `'${esc(notes)}'`});`,
      )

      const createdWorkout = toWorkoutDetails(db, workoutId)
      await json(201, createdWorkout)
      return
    }

    if (url.pathname === '/api/account') {
      if (method === 'GET') {
        if (!sessionUser) {
          await json(401, { error: 'Please login to access the Training Log App.' })
          return
        }

        await json(200, { username: sessionUser })
        return
      }

      if (method === 'DELETE') {
        if (!(await requireSession())) {
          return
        }

        const username = esc(sessionUser ?? '')
        db.run(`DELETE FROM exercises WHERE workout_id IN (SELECT id FROM workouts WHERE username = '${username}');`)
        db.run(`DELETE FROM workouts WHERE username = '${username}';`)
        db.run(`DELETE FROM users WHERE username = '${username}';`)
        sessionUser = null
        await json(200, { ok: true })
        return
      }

      await json(405, { error: 'Method not allowed.' })
      return
    }

    if (url.pathname === '/api/account/export') {
      if (!(await requireSession())) {
        return
      }

      const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json'
      const username = esc(sessionUser ?? '')

      const workoutsResult = db.exec(
        `SELECT
           id,
           name,
           date,
           num_sets AS numSets,
           num_reps AS numReps,
           weight_description AS weightDescription
         FROM workouts
         WHERE username = '${username}'
         ORDER BY date DESC;`,
      )[0] ?? null

      const workouts = asRows<Record<string, unknown>>(workoutsResult)
      const workoutIds = workouts.map((w) => Number(w.id))

      const exercises = workoutIds.length
        ? asRows<Record<string, unknown>>(
            db.exec(
              `SELECT
                 id,
                 workout_id AS workoutId,
                 description,
                 exercise_type AS exerciseType,
                 num_sets AS numSets,
                 num_reps AS numReps,
                 weight_description AS weightDescription,
                 duration_minutes AS durationMinutes,
                 speed_mph AS speedMph,
                 notes
               FROM exercises
               WHERE workout_id IN (${workoutIds.join(',')});`,
            )[0] ?? null,
          )
        : []

      const payload = {
        username: sessionUser,
        exportedAt: new Date().toISOString(),
        workouts: workouts.map((workout) => ({
          ...workout,
          exercises: exercises.filter((exercise) => exercise.workoutId === workout.id),
        })),
      }

      if (format === 'csv') {
        const csv = ['"username","workoutName"', ...workouts.map((w) => `"${sessionUser}","${String(w.name)}"`)].join('\n')
        await route.fulfill({
          status: 200,
          contentType: 'text/csv; charset=utf-8',
          body: csv,
        })
        return
      }

      await json(200, payload)
      return
    }

    if (url.pathname === '/api/workouts') {
      if (!(await requireSession())) {
        return
      }

      if (method === 'POST') {
        const name = String(body.name ?? '').trim()
        const date = String(body.date ?? '')

        if (name.length < 4 || name.length > 15) {
          await json(422, { error: 'Invalid workout entry.' })
          return
        }

        const duplicateResult = db.exec(
          `SELECT id FROM workouts WHERE username = '${esc(sessionUser ?? '')}' AND date = '${esc(date)}' LIMIT 1;`,
        )[0] ?? null
        if (asRows(duplicateResult).length > 0) {
          await json(422, { error: 'Invalid workout entry.' })
          return
        }

        const maxIdResult = db.exec('SELECT COALESCE(MAX(id), 0) AS maxId FROM workouts;')[0] ?? null
        const maxId = Number(asRows<{ maxId: number }>(maxIdResult)[0]?.maxId ?? 0)
        const newId = maxId + 1
        db.run(
          `INSERT INTO workouts (id, name, date, username, num_sets, num_reps, weight_description)
           VALUES (${newId}, '${esc(name)}', '${esc(date)}', '${esc(sessionUser ?? '')}', 1, 1, 'bodyweight');`,
        )

        await json(201, { id: newId, message: "You've successfully created a new workout." })
        return
      }

      if (method !== 'GET') {
        await json(405, { error: 'Method not allowed.' })
        return
      }

      const requestedPage = Number(url.searchParams.get('page') ?? '1')
      const pageNumber = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.trunc(requestedPage) : 1
      const offset = (pageNumber - 1) * pageSize

      const countResult = db.exec(
        `SELECT COUNT(id) AS count FROM workouts WHERE username = '${esc(sessionUser ?? '')}';`,
      )[0] ?? null
      const totalCount = Number(asRows<{ count: number }>(countResult)[0]?.count ?? 0)
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

      const listResult = db.exec(
        `SELECT
           id,
           name,
           date,
           username,
           num_sets AS numSets,
           num_reps AS numReps,
           weight_description AS weightDescription
         FROM workouts
         WHERE username = '${esc(sessionUser ?? '')}'
         ORDER BY date DESC
         LIMIT ${pageSize} OFFSET ${offset};`,
      )[0] ?? null

      await json(200, {
        items: asRows(listResult),
        totalPages,
      })
      return
    }

    const workoutMatch = url.pathname.match(/^\/api\/workouts\/(\d+)$/)
    if (workoutMatch) {
      if (!(await requireSession())) {
        return
      }

      const workoutId = Number(workoutMatch[1])
      const ownerResult = db.exec(`SELECT username FROM workouts WHERE id = ${workoutId} LIMIT 1;`)[0] ?? null
      const owner = asRows<{ username: string }>(ownerResult)[0]

      if (!owner) {
        await json(404, { error: 'Workout not found.' })
        return
      }

      if (owner.username !== sessionUser) {
        await json(403, { error: 'Forbidden.' })
        return
      }

      if (method === 'PUT') {
        const name = String(body.name ?? '').trim()
        const date = String(body.date ?? '')
        db.run(
          `UPDATE workouts SET name = '${esc(name)}', date = '${esc(date)}' WHERE id = ${workoutId};`,
        )
        await json(200, { message: 'Workout updated.' })
        return
      }

      if (method === 'DELETE') {
        db.run(`DELETE FROM exercises WHERE workout_id = ${workoutId};`)
        db.run(`DELETE FROM workouts WHERE id = ${workoutId};`)
        await json(200, { message: 'Workout deleted.' })
        return
      }

      if (method !== 'GET') {
        await json(405, { error: 'Method not allowed.' })
        return
      }

      const workout = toWorkoutDetails(db, workoutId)
      if (!workout) {
        await json(404, { error: 'Workout not found.' })
        return
      }

      await json(200, workout)
      return
    }

    const newExerciseMatch = url.pathname.match(/^\/api\/workouts\/(\d+)\/exercises$/)
    if (newExerciseMatch) {
      if (!(await requireSession())) {
        return
      }

      const workoutId = Number(newExerciseMatch[1])
      const workoutResult = db.exec(
        `SELECT username FROM workouts WHERE id = ${workoutId} LIMIT 1;`,
      )[0] ?? null
      const workout = asRows<{ username: string }>(workoutResult)[0]
      if (!workout || workout.username !== sessionUser) {
        await json(404, { error: 'Workout not found.' })
        return
      }

      if (method !== 'POST') {
        await json(405, { error: 'Method not allowed.' })
        return
      }

      const maxExerciseIdResult = db.exec('SELECT COALESCE(MAX(id), 0) AS maxId FROM exercises;')[0] ?? null
      const maxExerciseId = Number(asRows<{ maxId: number }>(maxExerciseIdResult)[0]?.maxId ?? 0)
      const newExerciseId = maxExerciseId + 1

      const exerciseType = String(body.exerciseType ?? 'strength')
      const numSets = body.numSets !== undefined ? Number(body.numSets) : null
      const numReps = body.numReps !== undefined ? Number(body.numReps) : null
      const weightDescription = body.weightDescription !== undefined ? String(body.weightDescription) : null
      const durationMinutes = body.durationMinutes !== undefined ? Number(body.durationMinutes) : null
      const speedMph = body.speedMph !== undefined ? Number(body.speedMph) : null
      const notes = body.notes !== undefined ? String(body.notes) : null

      db.run(
        `INSERT INTO exercises (id, workout_id, description, exercise_type, num_sets, num_reps, weight_description, duration_minutes, speed_mph, notes)
         VALUES (${newExerciseId}, ${workoutId}, '${esc(String(body.description ?? ''))}', '${esc(exerciseType)}',
           ${numSets === null ? 'NULL' : numSets}, ${numReps === null ? 'NULL' : numReps},
           ${weightDescription === null ? 'NULL' : `'${esc(weightDescription)}'`},
           ${durationMinutes === null ? 'NULL' : durationMinutes},
           ${speedMph === null ? 'NULL' : speedMph},
           ${notes === null ? 'NULL' : `'${esc(notes)}'`});`,
      )

      await json(201, { id: newExerciseId, message: 'Exercise created.' })
      return
    }

    const exerciseByIdMatch = url.pathname.match(/^\/api\/workouts\/(\d+)\/exercises\/(\d+)$/)
    if (exerciseByIdMatch) {
      if (!(await requireSession())) {
        return
      }

      const workoutId = Number(exerciseByIdMatch[1])
      const exerciseId = Number(exerciseByIdMatch[2])

      if (method === 'PUT') {
        const exerciseType = String(body.exerciseType ?? 'strength')
        const numSets = body.numSets !== undefined ? Number(body.numSets) : null
        const numReps = body.numReps !== undefined ? Number(body.numReps) : null
        const weightDescription = body.weightDescription !== undefined ? String(body.weightDescription) : null
        const durationMinutes = body.durationMinutes !== undefined ? Number(body.durationMinutes) : null
        const speedMph = body.speedMph !== undefined ? Number(body.speedMph) : null
        const notes = body.notes !== undefined ? String(body.notes) : null

        db.run(
          `UPDATE exercises
           SET description = '${esc(String(body.description ?? ''))}',
               exercise_type = '${esc(exerciseType)}',
               num_sets = ${numSets === null ? 'NULL' : numSets},
               num_reps = ${numReps === null ? 'NULL' : numReps},
               weight_description = ${weightDescription === null ? 'NULL' : `'${esc(weightDescription)}'`},
               duration_minutes = ${durationMinutes === null ? 'NULL' : durationMinutes},
               speed_mph = ${speedMph === null ? 'NULL' : speedMph},
               notes = ${notes === null ? 'NULL' : `'${esc(notes)}'`}
           WHERE id = ${exerciseId} AND workout_id = ${workoutId};`,
        )

        await json(200, { message: 'Exercise updated.' })
        return
      }

      if (method === 'DELETE') {
        db.run(`DELETE FROM exercises WHERE id = ${exerciseId} AND workout_id = ${workoutId};`)
        await json(200, { message: 'Exercise deleted.' })
        return
      }

      await json(405, { error: 'Method not allowed.' })
      return
    }

    await json(404, { error: `No mock API route for ${url.pathname}` })
  })
}
