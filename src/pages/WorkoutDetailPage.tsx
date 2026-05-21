import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { WorkoutDetails } from '../types/domain'

export const WorkoutDetailPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { pageNumber, workoutId } = useParams()
  const { currentUser } = useAuth()
  const page = Number(pageNumber) || 1
  const id = Number(workoutId)

  const [workout, setWorkout] = useState<WorkoutDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isEditingWorkout, setIsEditingWorkout] = useState(false)
  const [workoutName, setWorkoutName] = useState('')
  const [workoutDate, setWorkoutDate] = useState('')
  const [exerciseDescription, setExerciseDescription] = useState('')
  const [exerciseSets, setExerciseSets] = useState('3')
  const [exerciseReps, setExerciseReps] = useState('8')
  const [exerciseWeight, setExerciseWeight] = useState('bodyweight')
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null)

  useEffect(() => {
    let disposed = false

    const load = async (): Promise<void> => {
      try {
        setLoading(true)
        setError(null)
        const result = await api.getWorkout(id)

        if (!disposed) {
          setWorkout(result)
          setWorkoutName(result?.name ?? '')
          setWorkoutDate(result?.date ?? '')
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Unable to load workout.')
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    if (!Number.isFinite(id) || id <= 0) {
      setWorkout(null)
      setLoading(false)
      return
    }

    void load()

    return () => {
      disposed = true
    }
  }, [id])

  const isOwner = currentUser?.username === workout?.username

  const resetExerciseForm = (): void => {
    setExerciseDescription('')
    setExerciseSets('3')
    setExerciseReps('8')
    setExerciseWeight('bodyweight')
    setEditingExerciseId(null)
  }

  const submitWorkout = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    try {
      const updated = await api.updateWorkout({ id, name: workoutName, date: workoutDate })
      setWorkout(updated)
      setMessage('Workout updated.')
      setError(null)
      setIsEditingWorkout(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update workout.')
    }
  }

  const handleDeleteWorkout = async (): Promise<void> => {
    try {
      await api.deleteWorkout(id)
      navigate(`/training_log/${page}/workouts`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete workout.')
    }
  }

  const submitExercise = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    try {
      const payload = {
        description: exerciseDescription,
        numSets: Number(exerciseSets),
        numReps: Number(exerciseReps),
        weightDescription: exerciseWeight,
      }

      const updatedWorkout =
        editingExerciseId === null
          ? await api.createExercise(id, payload)
          : await api.updateExercise({ workoutId: id, exerciseId: editingExerciseId, ...payload })

      setWorkout(updatedWorkout)
      setMessage(editingExerciseId === null ? 'Exercise added.' : 'Exercise updated.')
      setError(null)
      resetExerciseForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save exercise.')
    }
  }

  const startEditingExercise = (exercise: WorkoutDetails['exercises'][number]): void => {
    setEditingExerciseId(exercise.id)
    setExerciseDescription(exercise.description)
    setExerciseSets(String(exercise.numSets))
    setExerciseReps(String(exercise.numReps))
    setExerciseWeight(exercise.weightDescription)
  }

  const handleDeleteExercise = async (exerciseId: number): Promise<void> => {
    try {
      const updatedWorkout = await api.deleteExercise(id, exerciseId)
      setWorkout(updatedWorkout)
      setMessage('Exercise deleted.')
      setError(null)
      if (editingExerciseId === exerciseId) {
        resetExerciseForm()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete exercise.')
    }
  }

  if (loading) {
    return <section className="card">Loading workout...</section>
  }

  if (error && !workout) {
    return (
      <section className="card">
        <h1>Workout Error</h1>
        <p className="error-text">{error}</p>
        <Link to={`/training_log/${page}/workouts`}>Back to workouts</Link>
      </section>
    )
  }

  if (!workout) {
    return (
      <section className="card">
        <h1>Workout Not Found</h1>
        <Link to={`/training_log/${page}/workouts`}>Back to workouts</Link>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="title-row">
        <h1>{workout.name}</h1>
        <Link className="secondary-link" to={`/training_log/${page}/workouts`}>
          Back to workouts
        </Link>
      </div>
      <p>
        {workout.date} · {workout.username}
      </p>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {isOwner ? (
        <section className="panel-block">
          <div className="title-row">
            <h2>Workout Controls</h2>
            <div className="row-actions">
              <button type="button" className="ghost-button" onClick={() => setIsEditingWorkout((value) => !value)}>
                {isEditingWorkout ? 'Cancel Edit' : 'Edit Workout'}
              </button>
              <button type="button" className="ghost-button danger-button" onClick={handleDeleteWorkout}>
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
                    {exercise.numSets} sets · {exercise.numReps} reps · {exercise.weightDescription}
                  </span>
                </div>
                {isOwner ? (
                  <div className="row-actions">
                    <button type="button" className="ghost-button" onClick={() => startEditingExercise(exercise)}>
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
            <h2>{editingExerciseId === null ? 'Add Exercise' : 'Edit Exercise'}</h2>
            {editingExerciseId !== null ? (
              <button type="button" className="ghost-button" onClick={resetExerciseForm}>
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
              required
            />
            <button type="submit">{editingExerciseId === null ? 'Add Exercise' : 'Save Exercise'}</button>
          </form>
        </section>
      ) : null}
    </section>
  )
}
