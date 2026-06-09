import { FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

export const NewWorkoutPage = (): JSX.Element => {
  const { pageNumber } = useParams()
  const page = Number(pageNumber) || 1
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setError(null)

    if (name.trim().length === 0 || date.trim().length === 0) {
      setError('Please enter workout name and date details.')
      return
    }

    localStorage.setItem('trainingLog:pendingWorkout', JSON.stringify({ name: name.trim(), date }))
    navigate(`/training_log/${page}/workouts/pending`)
  }

  return (
    <section className="card auth-card">
      <h1>Log New Workout</h1>
      <form className="stack-form" onSubmit={submit}>
        <label htmlFor="workout-name">Workout Name</label>
        <input id="workout-name" value={name} onChange={(event) => setName(event.target.value)} />

        <label htmlFor="workout-date">Workout Date</label>
        <input id="workout-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />

        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">Continue to Exercises</button>
      </form>
      <p>
        <Link to={`/training_log/${page}/workouts`}>Cancel</Link>
      </p>
    </section>
  )
}
