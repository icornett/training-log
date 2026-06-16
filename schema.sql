CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username varchar(25) UNIQUE NOT NULL,
  password text NOT NULL
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gdpr_consent_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gdpr_consent_version varchar(20);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gdpr_consent_ip varchar(64);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gdpr_consent_user_agent varchar(255);

CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  event_type varchar(40) NOT NULL,
  username varchar(25),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
  id serial PRIMARY KEY,
  name varchar(15) NOT NULL,
  "date" date NOT NULL,
  num_sets integer NOT NULL DEFAULT 0,
  num_reps integer NOT NULL DEFAULT 0,
  weight_description varchar(20) NOT NULL DEFAULT 'bodyweight',
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS num_sets integer NOT NULL DEFAULT 0;

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS num_reps integer NOT NULL DEFAULT 0;

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS weight_description varchar(20) NOT NULL DEFAULT 'bodyweight';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_combo_of_date_user'
      AND conrelid = 'workouts'::regclass
  ) THEN
    ALTER TABLE workouts
      ADD CONSTRAINT unique_combo_of_date_user UNIQUE (user_id, "date");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS exercises (
  id serial PRIMARY KEY,
  description varchar(40) NOT NULL,
  num_sets integer NOT NULL,
  num_reps integer NOT NULL,
  weight_description varchar(10) NOT NULL,
  workout_id integer NOT NULL REFERENCES workouts (id) ON DELETE CASCADE
);

INSERT INTO users (username, password)
VALUES
  ('Jane Doe', '$2a$12$Uubv1Jg03RokINCw6A0QmOdW3ak.LE2wd7vFbrgu7INcRQME64Xru'),
  ('A. Schwarz', '$2a$12$gca8QvTpYJayYOxI8mku6.0xe/d/5L3ljxyJzJGaPMLx6nCOB1fq2')
ON CONFLICT (username) DO NOTHING;

WITH seeded_workouts(username, name, workout_date, num_sets, num_reps, weight_description) AS (
  VALUES
    ('Jane Doe', 'Upper Body', '2022-01-03'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Lower Body', '2022-01-04'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Upper Body', '2022-01-06'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Lower Body', '2022-01-07'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Upper Body', '2022-01-10'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Lower Body', '2022-01-11'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Upper Body', '2022-01-13'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Lower Body', '2022-01-14'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Upper Body', '2022-01-17'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Lower Body', '2022-01-18'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Upper Body', '2022-01-20'::date, 3, 8, 'bodyweight'),
    ('Jane Doe', 'Lower Body', '2022-01-21'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Lower Body', '2022-03-07'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Upper Body', '2022-03-08'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Lower Body', '2022-03-10'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Upper Body', '2022-03-11'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Lower Body', '2022-03-12'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Upper Body', '2022-03-15'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Lower Body', '2022-03-16'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Upper Body', '2022-03-18'::date, 3, 8, 'bodyweight'),
    ('A. Schwarz', 'Lower Body', '2022-03-19'::date, 3, 8, 'bodyweight')
)
INSERT INTO workouts (name, "date", num_sets, num_reps, weight_description, user_id)
SELECT sw.name, sw.workout_date, sw.num_sets, sw.num_reps, sw.weight_description, u.id
FROM seeded_workouts sw
JOIN users u ON u.username = sw.username
ON CONFLICT (user_id, "date") DO NOTHING;

WITH workout_seed_map(seed_workout_id, username, workout_date) AS (
  VALUES
    (1, 'Jane Doe', '2022-01-03'::date),
    (2, 'Jane Doe', '2022-01-04'::date),
    (3, 'Jane Doe', '2022-01-06'::date),
    (4, 'Jane Doe', '2022-01-07'::date),
    (5, 'Jane Doe', '2022-01-10'::date),
    (6, 'Jane Doe', '2022-01-11'::date),
    (7, 'Jane Doe', '2022-01-13'::date),
    (8, 'Jane Doe', '2022-01-14'::date),
    (9, 'Jane Doe', '2022-01-17'::date),
    (10, 'Jane Doe', '2022-01-18'::date),
    (11, 'Jane Doe', '2022-01-20'::date),
    (12, 'Jane Doe', '2022-01-21'::date),
    (13, 'A. Schwarz', '2022-03-07'::date),
    (14, 'A. Schwarz', '2022-03-08'::date),
    (15, 'A. Schwarz', '2022-03-10'::date),
    (16, 'A. Schwarz', '2022-03-11'::date),
    (17, 'A. Schwarz', '2022-03-12'::date),
    (18, 'A. Schwarz', '2022-03-15'::date),
    (19, 'A. Schwarz', '2022-03-16'::date),
    (20, 'A. Schwarz', '2022-03-18'::date),
    (21, 'A. Schwarz', '2022-03-19'::date)
),
seeded_exercises(description, num_sets, num_reps, weight_description, seed_workout_id) AS (
  VALUES
    ('Bench Press', 3, 8, '65 lbs', 1),
    ('Barbell Row', 3, 8, '65 lbs', 1),
    ('Seated Overhead Dumbbell Press', 3, 8, '40 lbs', 1),
    ('Pushups', 3, 10, 'Bodyweight', 1),
    ('Assisted Pullups', 3, 8, 'Bodyweight', 1),
    ('Back Squat', 3, 8, '65 lbs', 2),
    ('Deadlift', 3, 8, '85 lbs', 2),
    ('Deficit Reverse Lunge', 3, 8, '65 lbs', 2),
    ('Hip Thrusts', 3, 10, '100 lbs', 2),
    ('Bench Press', 3, 8, '65 lbs', 3),
    ('Barbell Row', 3, 8, '65 lbs', 3),
    ('Seated Overhead Dumbbell Press', 3, 8, '40 lbs', 3),
    ('Pushups', 3, 10, 'Bodyweight', 3),
    ('Assisted Pullups', 3, 8, 'Bodyweight', 3),
    ('Back Squat', 3, 8, '65 lbs', 4),
    ('Deadlift', 3, 8, '85 lbs', 4),
    ('Deficit Reverse Lunge', 3, 8, '65 lbs', 4),
    ('Hip Thrusts', 3, 10, '100 lbs', 4),
    ('Bench Press', 4, 8, '65 lbs', 5),
    ('Barbell Row', 4, 8, '65 lbs', 5),
    ('Seated Overhead Dumbbell Press', 4, 8, '40 lbs', 5),
    ('Pushups', 4, 8, 'Bodyweight', 5),
    ('Assisted Pullups', 4, 8, 'Bodyweight', 5),
    ('Back Squat', 3, 10, '65 lbs', 6),
    ('Deadlift', 3, 10, '85 lbs', 6),
    ('Deficit Reverse Lunge', 3, 10, '65 lbs', 6),
    ('Hip Thrusts', 3, 12, '100 lbs', 6),
    ('Bench Press', 4, 8, '65 lbs', 7),
    ('Barbell Row', 4, 8, '65 lbs', 7),
    ('Seated Overhead Dumbbell Press', 4, 8, '40 lbs', 7),
    ('Pushups', 4, 8, 'Bodyweight', 7),
    ('Assisted Pullups', 4, 8, 'Bodyweight', 7),
    ('Back Squat', 3, 10, '65 lbs', 8),
    ('Deadlift', 3, 10, '85 lbs', 8),
    ('Deficit Reverse Lunge', 3, 10, '65 lbs', 8),
    ('Hip Thrusts', 3, 12, '100 lbs', 8),
    ('Bench Press', 3, 8, '75 lbs', 9),
    ('Barbell Row', 3, 8, '75 lbs', 9),
    ('Seated Overhead Dumbbell Press', 3, 8, '50 lbs', 9),
    ('Pushups', 4, 8, 'Bodyweight', 9),
    ('Assisted Pullups', 4, 8, 'Bodyweight', 9),
    ('Back Squat', 3, 8, '75 lbs', 10),
    ('Deadlift', 3, 8, '95 lbs', 10),
    ('Deficit Reverse Lunge', 3, 8, '75 lbs', 10),
    ('Hip Thrusts', 3, 10, '110 lbs', 10),
    ('Bench Press', 3, 8, '75 lbs', 11),
    ('Barbell Row', 3, 8, '75 lbs', 11),
    ('Seated Overhead Dumbbell Press', 3, 8, '50 lbs', 11),
    ('Pushups', 4, 8, 'Bodyweight', 11),
    ('Assisted Pullups', 4, 8, 'Bodyweight', 11),
    ('Back Squat', 3, 8, '75 lbs', 12),
    ('Deadlift', 3, 8, '95 lbs', 12),
    ('Deficit Reverse Lunge', 3, 8, '75 lbs', 12),
    ('Hip Thrusts', 3, 10, '110 lbs', 12),
    ('Back Squat', 6, 8, '200 lbs', 13),
    ('Deadlift', 6, 8, '225 lbs', 13),
    ('Leg Extensions', 6, 12, '175 lbs', 13),
    ('Barbell Lunges', 5, 15, '175 lbs', 13),
    ('Bench Press', 5, 10, '175 lbs', 14),
    ('Seated Rows', 6, 8, '155 lbs', 14),
    ('Dumbbell Pullovers', 5, 10, '75 lbs', 14),
    ('Chin Ups', 6, 15, 'Bodyweight', 14),
    ('Back Squat', 6, 10, '200 lbs', 15),
    ('Deadlift', 6, 10, '225 lbs', 15),
    ('Leg Extensions', 6, 12, '175 lbs', 15),
    ('Barbell Lunges', 5, 15, '175 lbs', 15),
    ('Bench Press', 5, 12, '175 lbs', 16),
    ('Seated Rows', 6, 10, '155 lbs', 16),
    ('Dumbbell Pullovers', 5, 12, '75 lbs', 16),
    ('Chin Ups', 6, 15, 'Bodyweight', 16),
    ('Back Squat', 6, 12, '200 lbs', 17),
    ('Deadlift', 6, 12, '225 lbs', 17),
    ('Leg Extensions', 6, 15, '175 lbs', 17),
    ('Barbell Lunges', 5, 15, '175 lbs', 17),
    ('Bench Press', 5, 10, '185 lbs', 18),
    ('Seated Rows', 6, 8, '165 lbs', 18),
    ('Dumbbell Pullovers', 5, 10, '75 lbs', 18),
    ('Chin Ups', 6, 15, 'Bodyweight', 18),
    ('Back Squat', 6, 10, '200 lbs', 19),
    ('Deadlift', 6, 10, '225 lbs', 19),
    ('Leg Extensions', 6, 12, '175 lbs', 19),
    ('Barbell Lunges', 5, 15, '175 lbs', 19),
    ('Bench Press', 5, 10, '185 lbs', 20),
    ('Seated Rows', 6, 8, '165 lbs', 20),
    ('Dumbbell Pullovers', 5, 10, '75 lbs', 20),
    ('Chin Ups', 6, 15, 'Bodyweight', 20),
    ('Back Squat', 6, 12, '200 lbs', 21),
    ('Deadlift', 6, 12, '225 lbs', 21),
    ('Leg Extensions', 6, 15, '175 lbs', 21),
    ('Barbell Lunges', 5, 15, '175 lbs', 21)
)
INSERT INTO exercises (description, num_sets, num_reps, weight_description, workout_id)
SELECT se.description, se.num_sets, se.num_reps, se.weight_description, w.id
FROM seeded_exercises se
JOIN workout_seed_map wm ON wm.seed_workout_id = se.seed_workout_id
JOIN users u ON u.username = wm.username
JOIN workouts w ON w.user_id = u.id AND w."date" = wm.workout_date
WHERE NOT EXISTS (
  SELECT 1
  FROM exercises e
  WHERE e.workout_id = w.id
    AND lower(e.description) = lower(se.description)
);

-- Expand exercise flexibility
ALTER TABLE exercises ALTER COLUMN description TYPE varchar(100);
ALTER TABLE exercises ALTER COLUMN weight_description DROP NOT NULL;
ALTER TABLE exercises ALTER COLUMN weight_description TYPE varchar(100);
ALTER TABLE exercises ALTER COLUMN num_sets DROP NOT NULL;
ALTER TABLE exercises ALTER COLUMN num_reps DROP NOT NULL;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type varchar(20) NOT NULL DEFAULT 'strength';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS duration_minutes numeric(5,1);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS speed_mph numeric(4,1);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS notes varchar(200);
