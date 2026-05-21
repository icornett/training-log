import { Link } from 'react-router-dom'

export const NotFoundPage = (): JSX.Element => {
  return (
    <section className="card">
      <h1>Page Not Found</h1>
      <p>The route you requested does not exist.</p>
      <Link to="/training_log/1/workouts">Return to workouts</Link>
    </section>
  )
}
