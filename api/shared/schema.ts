import {
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 25 }).unique().notNull(),
  password: text('password').notNull(),
})

export const workouts = pgTable(
  'workouts',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 15 }).notNull(),
    // Stored as a calendar date (no time component). Timezone policy: any full
    // timestamps added in future must use timestamptz so PostgreSQL stores in UTC.
    // Client is responsible for localizing display via formatWorkoutDate().
    date: date('date', { mode: 'string' }).notNull(),
    numSets: integer('num_sets').notNull().default(0),
    numReps: integer('num_reps').notNull().default(0),
    weightDescription: varchar('weight_description', { length: 20 }).notNull().default('bodyweight'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('unique_combo_of_date_user').on(t.userId, t.date)],
)

export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  description: varchar('description', { length: 40 }).notNull(),
  numSets: integer('num_sets'),
  numReps: integer('num_reps'),
  weightDescription: varchar('weight_description', { length: 10 }),
  workoutId: integer('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseType: varchar('exercise_type', { length: 20 }).notNull().default('strength'),
  durationMinutes: integer('duration_minutes'),
  speedMph: real('speed_mph'),
  notes: text('notes'),
})

export type User = typeof users.$inferSelect
export type Workout = typeof workouts.$inferSelect
export type Exercise = typeof exercises.$inferSelect
