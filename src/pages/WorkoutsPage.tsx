import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Pagination } from '../components/Pagination'
import { api } from '../services/api'
import type { WorkoutListItem } from '../types/domain'
import { formatWorkoutDate } from '../utils/date'

export const WorkoutsPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { pageNumber } = useParams()
  const parsedPage = Number(pageNumber)
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const [items, setItems] = useState<WorkoutListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [page])

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
        <table className="workouts-table">
          <thead>
            <tr>
              <th>Workout</th>
              <th>Date</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{formatWorkoutDate(item.date)}</td>
                <td>
                  <Link to={`/training_log/${page}/workouts/${item.id}`}>View Workout</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <Pagination pageNumber={Math.min(page, totalPages)} totalPages={totalPages} />
    </section>
  )
}
