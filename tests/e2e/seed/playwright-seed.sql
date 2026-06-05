CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  username TEXT NOT NULL,
  num_sets INTEGER NOT NULL,
  num_reps INTEGER NOT NULL,
  weight_description TEXT NOT NULL
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY,
  workout_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  num_sets INTEGER,
  num_reps INTEGER,
  weight_description TEXT,
  duration_minutes REAL,
  speed_mph REAL,
  notes TEXT
);

INSERT INTO users (id, username, password) VALUES
  (1, 'Playwright User', 'playwright-pass-123');

INSERT INTO workouts (id, name, date, username, num_sets, num_reps, weight_description) VALUES
  (101, 'Upper Body', '2026-06-01', 'Playwright User', 3, 8, 'bodyweight'),
  (102, 'Lower Body', '2026-06-03', 'Playwright User', 4, 10, '95 lbs');

INSERT INTO exercises (id, workout_id, description, exercise_type, num_sets, num_reps, weight_description, duration_minutes, speed_mph, notes) VALUES
  (1001, 101, 'Bench Press', 'strength', 3, 8, '65 lbs', NULL, NULL, NULL),
  (1002, 101, 'Treadmill Warmup', 'cardio', NULL, NULL, NULL, 10, 5.5, 'Easy pace');
