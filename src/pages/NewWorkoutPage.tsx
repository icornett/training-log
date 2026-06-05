import { FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../services/api'

export const NewWorkoutPage = (): JSX.Element => {
  const { pageNumber } = useParams()
  const page = Number(pageNumber) || 1
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [exerciseDescription, setExerciseDescription] = useState('')
  const [exerciseType, setExerciseType] = useState<'strength' | 'cardio'>('strength')
  const [exerciseSets, setExerciseSets] = useState('3')
  const [exerciseReps, setExerciseReps] = useState('8')
  const [exerciseWeight, setExerciseWeight] = useState('bodyweight')
  const [exerciseDuration, setExerciseDuration] = useState('')
  const [exerciseSpeed, setExerciseSpeed] = useState('')
  const [exerciseNotes, setExerciseNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitWorkoutDraft = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setError(null)

    if (name.trim().length === 0 || date.trim().length === 0) {
      setError('Please enter workout name and date details.')
      return
    }

    setDraftReady(true)
  }

  const submitFirstExercise = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (exerciseDescription.trim().length === 0) {
      setError('Please add an exercise description to save your workout.')
      return
    }

    const payload = {
      description: exerciseDescription,
      exerciseType,
      numSets: exerciseType === 'strength' ? Number(exerciseSets) : undefined,
      numReps: exerciseType === 'strength' ? Number(exerciseReps) : undefined,
      weightDescription: exerciseType === 'strength' ? exerciseWeight : undefined,
      durationMinutes: exerciseType === 'cardio' ? Number(exerciseDuration) : undefined,
      speedMph: exerciseType === 'cardio' ? Number(exerciseSpeed) : undefined,
      notes: exerciseNotes || '',
    }

    try {
      const created = await api.createWorkout({
        name: name.trim(),
        date,
      })

      try {
        await api.createExercise(created.id, payload)
      } catch (exerciseErr) {
        // Keep workouts from being persisted without at least one exercise.
        await api.deleteWorkout(created.id)
        throw exerciseErr
      }

      navigate(`/training_log/${page}/workouts/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save workout.')
    }
  }

  return (
    <section className="card auth-card">
      <h1>Log New Workout</h1>
      {!draftReady ? (
        <form className="stack-form" onSubmit={submitWorkoutDraft}>
          <label htmlFor="workout-name">Workout Name</label>
          <input id="workout-name" value={name} onChange={(event) => setName(event.target.value)} required />

          <label htmlFor="workout-date">Workout Date</label>
          <input id="workout-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />

          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit">Continue</button>
        </form>
      ) : (
        <form className="stack-form" onSubmit={submitFirstExercise}>
          <p>Add at least one exercise to save this workout.</p>

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
            onChange={(event) => setExerciseType(event.target.value as 'strength' | 'cardio')}
          >
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
          </select>

          {exerciseType === 'strength' ? (
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
                placeholder="e.g. 65 lbs, bodyweight"
                required
              />
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
              <label htmlFor="exercise-speed">Speed (mph)</label>
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
            placeholder="e.g. controlled tempo"
          />

          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit">Save Workout</button>
        </form>
      )}

      <p>
        <Link to={`/training_log/${page}/workouts`}>Cancel</Link>
      </p>
    </section>
  )
}
