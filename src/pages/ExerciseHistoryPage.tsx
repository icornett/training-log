import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'

import { ExerciseProgressChart } from '../components/ExerciseProgressChart'
import { api } from '../services/api'
import type { ExerciseProgressPayload, ExerciseProgressPoint } from '../types/domain'

const isCardioPoint = (point: ExerciseProgressPoint): boolean => {
  return point.speedMph !== null || point.durationMinutes !== null
}

const formatRecentEntry = (point: ExerciseProgressPoint): string => {
  if (isCardioPoint(point)) {
    const cardioParts: string[] = []
    if (point.speedMph !== null) {
      cardioParts.push(`${point.speedMph} mph`)
    }
    if (point.durationMinutes !== null) {
      cardioParts.push(`${point.durationMinutes} min`)
    }

    return cardioParts.length > 0 ? cardioParts.join(' - ') : 'Cardio entry'
  }

  if (point.weightDescription === null && (point.numSets === null || point.numReps === null)) {
    return 'No strength details'
  }

  const repsPart =
    point.numSets !== null && point.numReps !== null ? `${point.numSets} x ${point.numReps}` : 'sets/reps n/a'

  return `${point.weightDescription ?? 'No weight'} - ${repsPart}`
}

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

  const chartMode = useMemo<'strength-weight' | 'cardio-speed'>(() => {
    if (!payload) {
      return 'strength-weight'
    }

    return payload.points.some((point) => isCardioPoint(point)) ? 'cardio-speed' : 'strength-weight'
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
            mode={chartMode}
          />

          <article className="panel-block" aria-label="recent-history-details">
            <h2>Recent History Details</h2>
            <ul className="exercise-list">
              {recentEntries.map((point) => (
                <li
                  key={`${point.workoutId}:${point.workoutDate}:${point.weightDescription ?? point.speedMph ?? 'entry'}`}
                  className="exercise-row"
                >
                  <p>
                    <strong>{point.workoutDate}</strong>
                  </p>
                  <p>{formatRecentEntry(point)}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  )
}
