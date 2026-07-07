BEGIN;

CREATE TEMP TABLE seeded_users (
  username text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO seeded_users (username)
VALUES
  ('Playwright User iOS'),
  ('Playwright User Android'),
  ('Playwright User Chromium'),
  ('Playwright User Safari');

DELETE FROM exercises
WHERE workout_id IN (
  SELECT id
  FROM workouts
  WHERE user_id IN (
    SELECT u.id
    FROM users u
    JOIN seeded_users su ON su.username = u.username
  )
);

DELETE FROM workouts
WHERE user_id IN (
  SELECT u.id
  FROM users u
  JOIN seeded_users su ON su.username = u.username
);

DELETE FROM users
WHERE username IN (
  SELECT username
  FROM seeded_users
);

INSERT INTO users (username, password)
SELECT username, '$2a$12$5L6hTF9nEzj40gFkieIVauw99aSmcMEHyoLL/QiGkQOgHq3N6QDBO'
FROM seeded_users;

WITH seed_user AS (
  SELECT id, username
  FROM users
  WHERE username IN (SELECT username FROM seeded_users)
),
seeded_workouts(name, workout_date, num_sets, num_reps, weight_description) AS (
  VALUES
    ('Upper Body', '2026-06-01'::date, 3, 8, 'bodyweight'),
    ('Lower Body', '2026-06-03'::date, 4, 10, '95 lbs'),
    ('Upper Body', '2026-06-08'::date, 3, 8, 'bodyweight'),
    ('Lower Body', '2026-06-10'::date, 4, 10, '105 lbs')
),
inserted_workouts AS (
  INSERT INTO workouts (name, "date", num_sets, num_reps, weight_description, user_id)
  SELECT sw.name, sw.workout_date, sw.num_sets, sw.num_reps, sw.weight_description, su.id
  FROM seeded_workouts sw
  CROSS JOIN seed_user su
  RETURNING id, name, "date", user_id
)
INSERT INTO exercises (
  description,
  num_sets,
  num_reps,
  weight_description,
  exercise_type,
  duration_minutes,
  speed_mph,
  workout_id
)
SELECT 'Bench Press', 3, 8, '65 lbs', 'strength', NULL, NULL, iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Upper Body' AND iw."date" IN ('2026-06-01'::date, '2026-06-08'::date)
UNION ALL
SELECT 'Treadmill Warmup', 1, 1, NULL, 'cardio', 10.0, 5.2, iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Upper Body' AND iw."date" IN ('2026-06-01'::date, '2026-06-08'::date)
UNION ALL
SELECT 'Seated Row', 3, 10, '75 lbs', 'strength', NULL, NULL, iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Upper Body' AND iw."date" IN ('2026-06-01'::date, '2026-06-08'::date)
UNION ALL
SELECT 'Deadlift', 4, 5, CASE WHEN iw."date" = '2026-06-10'::date THEN '115 lbs' ELSE '95 lbs' END, 'strength', NULL, NULL, iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Lower Body' AND iw."date" IN ('2026-06-03'::date, '2026-06-10'::date)
UNION ALL
SELECT 'Goblet Squat', 4, 10, CASE WHEN iw."date" = '2026-06-10'::date THEN '65 lbs' ELSE '55 lbs' END, 'strength', NULL, NULL, iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Lower Body' AND iw."date" IN ('2026-06-03'::date, '2026-06-10'::date)
UNION ALL
SELECT 'Walking Lunges', 3, 12, 'bodyweight', 'strength', NULL, NULL, iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Lower Body' AND iw."date" IN ('2026-06-03'::date, '2026-06-10'::date);

COMMIT;