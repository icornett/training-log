-- Migration: 20260707230000_add_exercise_sets (up)
BEGIN;

-- Per-set exercise breakdown (additive, backward compatible)
CREATE TABLE IF NOT EXISTS exercise_sets (
  id serial PRIMARY KEY,
  exercise_id integer NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  set_index integer NOT NULL,
  reps integer,
  weight_description varchar(100),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ux_exercise_sets_exercise_id_set_index'
      AND conrelid = 'exercise_sets'::regclass
  ) THEN
    ALTER TABLE exercise_sets
      ADD CONSTRAINT ux_exercise_sets_exercise_id_set_index UNIQUE (exercise_id, set_index);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercise_sets_exercise_id
  ON exercise_sets (exercise_id);

COMMIT;
