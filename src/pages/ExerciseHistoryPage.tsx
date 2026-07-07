import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'

import { ExerciseProgressChart } from '../components/ExerciseProgressChart'
import { api } from '../services/api'
import type { ExerciseProgressPayload } from '../types/domain'

export const ExerciseHistoryPage = (): JSX.Element => {
  const { pageNumber } = useParams()
  const page = Number(pageNumber) || 1
  const [searchParams, setSearchParams] = useSearchParams()
  const activeExercise = (searchParams.get('exercise') ?? '').trim()

  const [exerciseInput, setExerciseInput] = useState(activeExercise)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ExerciseProgressPayload | null>(null)

  useEffect(() => {
    setExerciseInput(activeExercise)
  }, [activeExercise])

  useEffect(() => {
    let disposed = false

    const load = async (): Promise<void> => {
      if (!activeExercise) {
        setLoading(false)
        setError(null)
        setPayload(null)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const result = await api.getExerciseProgress({
          exercise: activeExercise,
          limit: 120,
        })

        if (!disposed) {
          setPayload(result)
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Unable to load exercise history.')
          setPayload(null)
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [activeExercise])

  const recentEntries = useMemo(() => {
    if (!payload) {
      return []
    }

    return [...payload.points].reverse().slice(0, 5)
  }, [payload])

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const next = exerciseInput.trim()

    if (!next) {
      setSearchParams({})
      return
    }

    setSearchParams({ exercise: next })
  }

  return (
    <section className="card">
      <div className="title-row">
        <h1>Exercise History</h1>
        <Link className="secondary-link" to={`/training_log/${page}/workouts`}>
          Back to Workouts
        </Link>
      </div>

      <form className="stack-form" onSubmit={handleSubmit}>
        <label htmlFor="exercise-history-input">Exercise name</label>
        <input
          id="exercise-history-input"
          value={exerciseInput}
          onChange={(event) => setExerciseInput(event.target.value)}
          placeholder="e.g. bench press"
        />
        <button type="submit">Load History</button>
      </form>

      {loading ? <p>Loading exercise history...</p> : null}
      {!loading && error ? <p className="error-text">{error}</p> : null}

      {!loading && !error && !activeExercise ? <p>Enter an exercise to view history.</p> : null}

      {!loading && !error && payload && payload.points.length === 0 ? (
        <p>No history available yet for {payload.exerciseDescription}.</p>
      ) : null}

      {!loading && !error && payload && payload.points.length > 0 ? (
        <div className="stack">
          <ExerciseProgressChart
            points={payload.points}
            exerciseDescription={payload.exerciseDescription}
            mode="strength-weight"
          />

          <article className="panel-block" aria-label="recent-history-details">
            <h2>Recent History Details</h2>
            <ul className="exercise-list">
              {recentEntries.map((point) => (
                <li key={point.workoutId} className="exercise-row">
                  <p>
                    <strong>{point.workoutDate}</strong>
                  </p>
                  <p>
                    {point.weightDescription ?? 'No weight'}
                    {point.numSets !== null && point.numReps !== null
                      ? ` - ${point.numSets} x ${point.numReps}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  )
}
