import { FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../services/api'

export const NewWorkoutPage = (): JSX.Element => {
  const { pageNumber } = useParams()
  const page = Number(pageNumber) || 1
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [numSets, setNumSets] = useState('3')
  const [numReps, setNumReps] = useState('8')
  const [weightDescription, setWeightDescription] = useState('bodyweight')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (name.trim().length === 0 || date.trim().length === 0) {
      setError('Please enter workout name and date details.')
      return
    }

    try {
      const created = await api.createWorkout({
        name: name.trim(),
        date,
        numSets: Number(numSets),
        numReps: Number(numReps),
        weightDescription: weightDescription.trim().toLowerCase(),
      })
      navigate(`/training_log/${page}/workouts/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create workout.')
    }
  }

  return (
    <section className="card auth-card">
      <h1>Log New Workout</h1>
      <form className="stack-form" onSubmit={submit}>
        <label htmlFor="workout-name">Workout Name</label>
        <input id="workout-name" value={name} onChange={(event) => setName(event.target.value)} required />

        <label htmlFor="workout-date">Workout Date</label>
        <input id="workout-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />

        <label htmlFor="workout-sets">Sets</label>
        <input
          id="workout-sets"
          type="number"
          min="1"
          value={numSets}
          onChange={(event) => setNumSets(event.target.value)}
          required
        />

        <label htmlFor="workout-reps">Reps</label>
        <input
          id="workout-reps"
          type="number"
          min="1"
          value={numReps}
          onChange={(event) => setNumReps(event.target.value)}
          required
        />

        <label htmlFor="workout-weight">Weight</label>
        <input
          id="workout-weight"
          value={weightDescription}
          onChange={(event) => setWeightDescription(event.target.value)}
          required
        />

        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">Create Workout</button>
      </form>
      <p>
        <Link to={`/training_log/${page}/workouts`}>Cancel</Link>
      </p>
    </section>
  )
}
