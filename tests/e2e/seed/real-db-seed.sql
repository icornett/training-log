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
    ('Lower Body', '2026-06-03'::date, 4, 10, '95 lbs')
),
inserted_workouts AS (
  INSERT INTO workouts (name, "date", num_sets, num_reps, weight_description, user_id)
  SELECT sw.name, sw.workout_date, sw.num_sets, sw.num_reps, sw.weight_description, su.id
  FROM seeded_workouts sw
  CROSS JOIN seed_user su
  RETURNING id, name, "date", user_id
)
INSERT INTO exercises (description, num_sets, num_reps, weight_description, workout_id)
SELECT 'Bench Press', 3, 8, '65 lbs', iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Upper Body' AND iw."date" = '2026-06-01'::date
UNION ALL
SELECT 'Treadmill Warmup', 10, 1, 'bodyweight', iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Upper Body' AND iw."date" = '2026-06-01'::date
UNION ALL
SELECT 'Deadlift', 4, 5, '95 lbs', iw.id
FROM inserted_workouts iw
WHERE iw.name = 'Lower Body' AND iw."date" = '2026-06-03'::date;

COMMIT;