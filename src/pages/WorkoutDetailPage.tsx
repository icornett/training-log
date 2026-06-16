import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { WorkoutDetails } from '../types/domain'
import { formatWorkoutDate } from '../utils/date'
import { mphToKph } from '../utils/speed'

export const WorkoutDetailPage = (): JSX.Element | null => {
  const navigate = useNavigate();
  const { pageNumber, workoutId } = useParams();
  const { currentUser } = useAuth();
  const page = Number(pageNumber) || 1;
  const id = Number(workoutId);
  const isPending = workoutId === "pending";

  const [workout, setWorkout] = useState<WorkoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutDate, setWorkoutDate] = useState("");
  const [exerciseDescription, setExerciseDescription] = useState("");
  const [exerciseType, setExerciseType] = useState<"strength" | "cardio">(
    "strength",
  );
  const [exerciseSets, setExerciseSets] = useState("3");
  const [exerciseReps, setExerciseReps] = useState("8");
  const [exerciseWeight, setExerciseWeight] = useState("bodyweight");
  const [exerciseWeightUnit, setExerciseWeightUnit] = useState<"lbs" | "kg">(
    "lbs",
  );
  const [exerciseDuration, setExerciseDuration] = useState("");
  const [exerciseSpeed, setExerciseSpeed] = useState("");
  const [exerciseSpeedUnit, setExerciseSpeedUnit] = useState<"mph" | "kmh">(
    "mph",
  );
  const [exerciseNotes, setExerciseNotes] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (isPending) return;

    let disposed = false;

    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getWorkout(id);

        if (!disposed) {
          setWorkout(result);
          setWorkoutName(result?.name ?? "");
          setWorkoutDate(result?.date ?? "");
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error ? err.message : "Unable to load workout.",
          );
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    if (!Number.isFinite(id) || id <= 0) {
      setWorkout(null);
      setLoading(false);
      return;
    }

    void load();

    return () => {
      disposed = true;
    };
  }, [id, isPending]);

  useEffect(() => {
    if (!isPending) return;

    const raw = localStorage.getItem("trainingLog:pendingWorkout");
    if (!raw) {
      navigate(`/training_log/${page}/workouts/new`, { replace: true });
      return;
    }

    try {
      const { name: pName, date: pDate } = JSON.parse(raw) as {
        name: string;
        date: string;
      };
      setWorkoutName(pName);
      setWorkoutDate(pDate);
    } catch {
      navigate(`/training_log/${page}/workouts/new`, { replace: true });
      return;
    }

    setLoading(false);
  }, [isPending, navigate, page]);

  const isOwner = currentUser?.username === workout?.username;

  const normalizeStrengthWeight = (
    rawWeight: string,
    unit: "lbs" | "kg",
  ): string => {
    const trimmed = rawWeight.trim();
    if (trimmed.length === 0) {
      return "";
    }

    if (trimmed.toLowerCase() === "bodyweight") {
      return "bodyweight";
    }

    // Keep explicit user-supplied units for advanced entries like "25, 20, 15 lbs".
    if (/\b(lb|lbs|kg|kgs)\b/i.test(trimmed)) {
      return trimmed;
    }

    return `${trimmed} ${unit === "kg" ? "kgs" : "lbs"}`;
  };

  const resetExerciseForm = (): void => {
    setExerciseDescription("");
    setExerciseType("strength");
    setExerciseSets("3");
    setExerciseReps("8");
    setExerciseWeight("bodyweight");
    setExerciseWeightUnit("lbs");
    setExerciseDuration("");
    setExerciseSpeed("");
    setExerciseSpeedUnit("mph");
    setExerciseNotes("");
    setEditingExerciseId(null);
  };

  const submitWorkout = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    try {
      const updated = await api.updateWorkout({
        id,
        name: workoutName,
        date: workoutDate,
      });
      setWorkout(updated);
      setMessage("Workout updated.");
      setError(null);
      setIsEditingWorkout(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update workout.",
      );
    }
  };

  const handleDeleteWorkout = async (): Promise<void> => {
    try {
      await api.deleteWorkout(id);
      navigate(`/training_log/${page}/workouts`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete workout.",
      );
    }
  };

  const submitExercise = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    try {
      const payload = {
        description: exerciseDescription,
        exerciseType,
        numSets: exerciseType === "strength" ? Number(exerciseSets) : undefined,
        numReps: exerciseType === "strength" ? Number(exerciseReps) : undefined,
        weightDescription:
          exerciseType === "strength"
            ? normalizeStrengthWeight(exerciseWeight, exerciseWeightUnit)
            : undefined,
        durationMinutes:
          exerciseType === "cardio" ? Number(exerciseDuration) : undefined,
        speedUnit: exerciseType === "cardio" ? exerciseSpeedUnit : undefined,
        speedMph:
          exerciseType === "cardio" && exerciseSpeedUnit === "mph"
            ? Number(exerciseSpeed)
            : undefined,
        speedKph:
          exerciseType === "cardio" && exerciseSpeedUnit === "kmh"
            ? Number(exerciseSpeed)
            : undefined,
        notes: exerciseNotes || "",
      };

      if (!isPending && editingExerciseId === null) {
        const normalizedDescription = exerciseDescription.trim().toLowerCase();
        const hasDuplicate =
          workout?.exercises.some(
            (exercise) =>
              exercise.description.trim().toLowerCase() ===
              normalizedDescription,
          ) ?? false;

        if (hasDuplicate) {
          setError("This exercise already exists for the workout.");
          setMessage(null);
          return;
        }
      }

      if (isPending && editingExerciseId === null) {
        const raw = localStorage.getItem("trainingLog:pendingWorkout");
        if (!raw) {
          setError("Workout data was lost. Please start again.");
          return;
        }
        const { name: wName, date: wDate } = JSON.parse(raw) as {
          name: string;
          date: string;
        };
        const newWorkout = await api.createWorkoutWithExercise(
          { name: wName, date: wDate },
          payload,
        );
        localStorage.removeItem("trainingLog:pendingWorkout");
        setMessage("Exercise added.");
        setError(null);
        // Allow message to render before navigation
        setTimeout(() => {
          navigate(`/training_log/${page}/workouts/${newWorkout.id}`, {
            replace: true,
          });
        }, 500);
        return;
      }

      const updatedWorkout =
        editingExerciseId === null
          ? await api.createExercise(id, payload)
          : await api.updateExercise({
              workoutId: id,
              exerciseId: editingExerciseId,
              ...payload,
            });

      setWorkout(updatedWorkout);
      setMessage(
        editingExerciseId === null ? "Exercise added." : "Exercise updated.",
      );
      setError(null);
      resetExerciseForm();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to save exercise.";
      console.error("Exercise save error:", err); // Add this for CI inspection
      setError(msg);
    }
  };

  const startEditingExercise = (
    exercise: WorkoutDetails["exercises"][number],
  ): void => {
    setEditingExerciseId(exercise.id);
    setExerciseDescription(exercise.description);
    setExerciseType(exercise.exerciseType as "strength" | "cardio");
    setExerciseSets(String(exercise.numSets ?? 3));
    setExerciseReps(String(exercise.numReps ?? 8));
    setExerciseWeight(exercise.weightDescription ?? "bodyweight");
    setExerciseWeightUnit(
      /\b(kg|kgs)\b/i.test(exercise.weightDescription ?? "") ? "kg" : "lbs",
    );
    setExerciseDuration(String(exercise.durationMinutes ?? ""));
    setExerciseSpeed(String(exercise.speedMph ?? ""));
    setExerciseSpeedUnit("mph");
    setExerciseNotes(exercise.notes ?? "");
  };

  const handleDeleteExercise = async (exerciseId: number): Promise<void> => {
    try {
      const updatedWorkout = await api.deleteExercise(id, exerciseId);
      setWorkout(updatedWorkout);
      setMessage("Exercise deleted.");
      setError(null);
      if (editingExerciseId === exerciseId) {
        resetExerciseForm();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete exercise.",
      );
    }
  };

  if (loading) {
    return <section className="card">Loading workout...</section>;
  }

  if (error && !workout && !isPending) {
    return (
      <section className="card">
        <h1>Workout Error</h1>
        <p className="error-text">{error}</p>
        <Link to={`/training_log/${page}/workouts`}>Back to workouts</Link>
      </section>
    );
  }

  if (!workout && !isPending) {
    return (
      <section className="card">
        <h1>Workout Not Found</h1>
        <Link to={`/training_log/${page}/workouts`}>Back to workouts</Link>
      </section>
    );
  }

  if (isPending) {
    return (
      <section className="card">
        <div className="title-row">
          <h1>{workoutName}</h1>
          <Link
            className="secondary-link"
            to={`/training_log/${page}/workouts/new`}
          >
            Cancel
          </Link>
        </div>
        <p>{workoutDate}</p>
        <p>Add your first exercise to save this workout.</p>
        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        <section className="panel-block">
          <h2>Add Exercise</h2>
          <form className="stack-form compact-form" onSubmit={submitExercise}>
            <label htmlFor="exercise-description">Description</label>
            <input
              id="exercise-description"
              value={exerciseDescription}
              onChange={(event) => setExerciseDescription(event.target.value)}
              required
            />

            <label htmlFor="exercise-type">Exercise Type</label>
            <select
              id="exercise-type"
              value={exerciseType}
              onChange={(event) =>
                setExerciseType(event.target.value as "strength" | "cardio")
              }
            >
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
            </select>

            {exerciseType === "strength" ? (
              <>
                <label htmlFor="exercise-sets">Sets</label>
                <input
                  id="exercise-sets"
                  type="number"
                  min="1"
                  value={exerciseSets}
                  onChange={(event) => setExerciseSets(event.target.value)}
                  required
                />
                <label htmlFor="exercise-reps">Reps</label>
                <input
                  id="exercise-reps"
                  type="number"
                  min="1"
                  value={exerciseReps}
                  onChange={(event) => setExerciseReps(event.target.value)}
                  required
                />
                <label htmlFor="exercise-weight">Weight</label>
                <input
                  id="exercise-weight"
                  value={exerciseWeight}
                  onChange={(event) => setExerciseWeight(event.target.value)}
                  placeholder="e.g. 65, 25, 20, 15, bodyweight"
                  required
                />
                <label htmlFor="exercise-weight-unit">Weight Unit</label>
                <select
                  id="exercise-weight-unit"
                  value={exerciseWeightUnit}
                  onChange={(event) =>
                    setExerciseWeightUnit(event.target.value as "lbs" | "kg")
                  }
                >
                  <option value="lbs">lbs (default)</option>
                  <option value="kg">kg</option>
                </select>
              </>
            ) : (
              <>
                <label htmlFor="exercise-duration">Duration (minutes)</label>
                <input
                  id="exercise-duration"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={exerciseDuration}
                  onChange={(event) => setExerciseDuration(event.target.value)}
                  required
                />
                <label htmlFor="exercise-speed-unit">Speed Unit</label>
                <select
                  id="exercise-speed-unit"
                  value={exerciseSpeedUnit}
                  onChange={(event) =>
                    setExerciseSpeedUnit(event.target.value as "mph" | "kmh")
                  }
                >
                  <option value="mph">mph</option>
                  <option value="kmh">km/h</option>
                </select>
                <label htmlFor="exercise-speed">
                  {exerciseSpeedUnit === "mph" ? "Speed (mph)" : "Speed (km/h)"}
                </label>
                <input
                  id="exercise-speed"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={exerciseSpeed}
                  onChange={(event) => setExerciseSpeed(event.target.value)}
                  required
                />
              </>
            )}

            <label htmlFor="exercise-notes">Notes (optional)</label>
            <input
              id="exercise-notes"
              value={exerciseNotes}
              onChange={(event) => setExerciseNotes(event.target.value)}
              placeholder="e.g. explosive power, incline 5%"
            />

            <button type="submit">Add Exercise</button>
          </form>
        </section>
      </section>
    );
  }

  if (!workout) return null;

  return (
    <section className="card">
      <div className="title-row">
        <h1>{workout.name}</h1>
        <Link className="secondary-link" to={`/training_log/${page}/workouts`}>
          Back to workouts
        </Link>
      </div>
      <p>
        {formatWorkoutDate(workout.date)} · {workout.username}
      </p>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {isOwner ? (
        <section className="panel-block">
          <div className="title-row">
            <h2>Workout Controls</h2>
            <div className="row-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsEditingWorkout((value) => !value)}
              >
                {isEditingWorkout ? "Cancel Edit" : "Edit Workout"}
              </button>
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={handleDeleteWorkout}
              >
                Delete Workout
              </button>
            </div>
          </div>

          {isEditingWorkout ? (
            <form className="stack-form compact-form" onSubmit={submitWorkout}>
              <label htmlFor="workout-name-edit">Workout Name</label>
              <input
                id="workout-name-edit"
                value={workoutName}
                onChange={(event) => setWorkoutName(event.target.value)}
                required
              />
              <label htmlFor="workout-date-edit">Workout Date</label>
              <input
                id="workout-date-edit"
                type="date"
                value={workoutDate}
                onChange={(event) => setWorkoutDate(event.target.value)}
                required
              />
              <button type="submit">Save Workout</button>
            </form>
          ) : null}
        </section>
      ) : null}

      <h2>Exercises</h2>
      {workout.exercises.length === 0 ? <p>No exercises logged yet.</p> : null}
      {workout.exercises.length > 0 ? (
        <ul className="exercise-list">
          {workout.exercises.map((exercise) => (
            <li key={exercise.id}>
              <div className="exercise-row">
                <div>
                  <strong>{exercise.description}</strong>
                  <span>
                    {exercise.exerciseType === "strength" &&
                    exercise.numSets &&
                    exercise.numReps
                      ? `${exercise.numSets} sets × ${exercise.numReps} reps${exercise.weightDescription ? ` · ${exercise.weightDescription}` : ""}`
                      : exercise.exerciseType === "cardio" &&
                          exercise.durationMinutes &&
                          exercise.speedMph
                        ? `${exercise.durationMinutes} min @ ${exercise.speedMph} mph (${mphToKph(exercise.speedMph).toFixed(1)} km/h)`
                        : ""}
                    {exercise.notes ? ` · ${exercise.notes}` : ""}
                  </span>
                </div>
                {isOwner ? (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => startEditingExercise(exercise)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-button danger-button"
                      onClick={() => handleDeleteExercise(exercise.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isOwner ? (
        <section className="panel-block">
          <div className="title-row">
            <h2>
              {editingExerciseId === null ? "Add Exercise" : "Edit Exercise"}
            </h2>
            {editingExerciseId !== null ? (
              <button
                type="button"
                className="ghost-button"
                onClick={resetExerciseForm}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
          <form className="stack-form compact-form" onSubmit={submitExercise}>
            <label htmlFor="exercise-description">Description</label>
            <input
              id="exercise-description"
              value={exerciseDescription}
              onChange={(event) => setExerciseDescription(event.target.value)}
              required
            />

            <label htmlFor="exercise-type">Exercise Type</label>
            <select
              id="exercise-type"
              value={exerciseType}
              onChange={(event) =>
                setExerciseType(event.target.value as "strength" | "cardio")
              }
            >
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
            </select>

            {exerciseType === "strength" ? (
              <>
                <label htmlFor="exercise-sets">Sets</label>
                <input
                  id="exercise-sets"
                  type="number"
                  min="1"
                  value={exerciseSets}
                  onChange={(event) => setExerciseSets(event.target.value)}
                  required
                />
                <label htmlFor="exercise-reps">Reps</label>
                <input
                  id="exercise-reps"
                  type="number"
                  min="1"
                  value={exerciseReps}
                  onChange={(event) => setExerciseReps(event.target.value)}
                  required
                />
                <label htmlFor="exercise-weight">Weight</label>
                <input
                  id="exercise-weight"
                  value={exerciseWeight}
                  onChange={(event) => setExerciseWeight(event.target.value)}
                  placeholder="e.g. 65, 25, 20, 15, bodyweight"
                  required
                />
                <label htmlFor="exercise-weight-unit">Weight Unit</label>
                <select
                  id="exercise-weight-unit"
                  value={exerciseWeightUnit}
                  onChange={(event) =>
                    setExerciseWeightUnit(event.target.value as "lbs" | "kg")
                  }
                >
                  <option value="lbs">lbs (default)</option>
                  <option value="kg">kg</option>
                </select>
              </>
            ) : (
              <>
                <label htmlFor="exercise-duration">Duration (minutes)</label>
                <input
                  id="exercise-duration"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={exerciseDuration}
                  onChange={(event) => setExerciseDuration(event.target.value)}
                  required
                />
                <label htmlFor="exercise-speed-unit">Speed Unit</label>
                <select
                  id="exercise-speed-unit"
                  value={exerciseSpeedUnit}
                  onChange={(event) =>
                    setExerciseSpeedUnit(event.target.value as "mph" | "kmh")
                  }
                >
                  <option value="mph">mph</option>
                  <option value="kmh">km/h</option>
                </select>
                <label htmlFor="exercise-speed">
                  {exerciseSpeedUnit === "mph" ? "Speed (mph)" : "Speed (km/h)"}
                </label>
                <input
                  id="exercise-speed"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={exerciseSpeed}
                  onChange={(event) => setExerciseSpeed(event.target.value)}
                  required
                />
              </>
            )}

            <label htmlFor="exercise-notes">Notes (optional)</label>
            <input
              id="exercise-notes"
              value={exerciseNotes}
              onChange={(event) => setExerciseNotes(event.target.value)}
              placeholder="e.g. explosive power, incline 5%"
            />

            <button type="submit">
              {editingExerciseId === null ? "Add Exercise" : "Save Exercise"}
            </button>
          </form>
        </section>
      ) : null}
    </section>
  );
};
