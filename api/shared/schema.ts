import {
  date,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  timestamp,
  text,
  uniqueIndex,
  varchar,
  index,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 25 }).unique().notNull(),
  password: text('password').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  gdprConsentAt: timestamp('gdpr_consent_at', { withTimezone: true, mode: 'string' }),
  gdprConsentVersion: varchar('gdpr_consent_version', { length: 20 }),
  gdprConsentIp: varchar('gdpr_consent_ip', { length: 64 }),
  gdprConsentUserAgent: varchar('gdpr_consent_user_agent', { length: 255 }),
  favoriteTeamKey: varchar('favorite_team_key', { length: 32 }),
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

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  username: varchar('username', { length: 25 }),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
})

export const operationDedup = pgTable(
  'operation_dedup',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    operationId: varchar('operation_id', { length: 36 }).notNull(),
    resultJson: jsonb('result_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('unique_user_operation_id').on(t.userId, t.operationId),
    index('idx_operation_dedup_user_id').on(t.userId),
    index('idx_operation_dedup_created_at').on(t.createdAt),
  ],
)

export type User = typeof users.$inferSelect
export type Workout = typeof workouts.$inferSelect
export type Exercise = typeof exercises.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type OperationDedup = typeof operationDedup.$inferSelect
