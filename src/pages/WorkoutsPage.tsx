import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Pagination } from '../components/Pagination'
import { syncStatusChangedEventName } from '../services/localStore'
import { api } from '../services/api'
import type { WorkoutListItem } from '../types/domain'
import { formatWorkoutDate } from '../utils/date'

const getSyncLabel = (pendingState?: WorkoutListItem['pendingState']): string | null => {
  if (pendingState === 'pending') {
    return 'Pending sync'
  }

  if (pendingState === 'conflict') {
    return 'Sync conflict'
  }

  return null
}

export const WorkoutsPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { pageNumber } = useParams()
  const parsedPage = Number(pageNumber)
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const [items, setItems] = useState<WorkoutListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncVersion, setSyncVersion] = useState(0)

  useEffect(() => {
    let disposed = false

    const load = async (): Promise<void> => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.listWorkouts(page)

        if (!disposed) {
          setItems(response.items)
          setTotalPages(response.totalPages)
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Unable to load workouts.')
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
  }, [page, syncVersion])

  useEffect(() => {
    const handleSyncStatusChanged = (): void => {
      setSyncVersion((value) => value + 1)
    }

    window.addEventListener(syncStatusChangedEventName, handleSyncStatusChanged)

    return () => {
      window.removeEventListener(syncStatusChangedEventName, handleSyncStatusChanged)
    }
  }, [])

  useEffect(() => {
    if (!pageNumber || page !== parsedPage) {
      navigate('/training_log/1/workouts', { replace: true })
    }
  }, [navigate, pageNumber, page, parsedPage])

  return (
    <section className="card">
      <div className="title-row">
        <h1>Workouts</h1>
        <Link className="secondary-link" to={`/training_log/${page}/workouts/new`}>
          Log New Workout
        </Link>
      </div>

      {loading ? <p>Loading workouts...</p> : null}
      {!loading && error ? <p className="error-text">{error}</p> : null}

      {!loading && !error && items.length === 0 ? <p>No workouts yet.</p> : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="workout-feed" aria-label="Workout list">
          {items.map((item) => {
            const syncLabel = getSyncLabel(item.pendingState)

            return (
              <li key={item.id} className="workout-card">
                <div className="workout-card-header">
                  <Link className="workout-card-title" to={`/training_log/${page}/workouts/${item.id}`}>
                    {item.name}
                  </Link>
                  {syncLabel ? (
                    <span
                      className={`status-chip ${
                        item.pendingState === 'conflict' ? 'status-chip-conflict' : 'status-chip-pending'
                      }`}
                    >
                      {syncLabel}
                    </span>
                  ) : null}
                </div>
                <p className="workout-card-meta">{formatWorkoutDate(item.date)}</p>
                <p className="workout-card-meta">{item.weightDescription}</p>
                <Link className="secondary-link" to={`/training_log/${page}/workouts/${item.id}`}>
                  View Workout
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}

      <Pagination pageNumber={Math.min(page, totalPages)} totalPages={totalPages} />
    </section>
  )
}
