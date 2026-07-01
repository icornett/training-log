import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export const AuthLandingPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  useEffect(() => {
    if (currentUser) {
      navigate('/training_log/1/workouts', { replace: true })
    }
  }, [currentUser, navigate])

  return (
    <section className="card auth-card">
      <h1>Welcome to Training Log</h1>
      <p>Choose how you want to continue.</p>
      <p>
        On first login, your theme starts with Seattle Seahawks colors. You can change it any time in
        Account Settings under Favorite Team Theme.
      </p>
      <div className="row-actions">
        <Link className="cta-link" to="/login">
          Login
        </Link>
        <Link className="cta-link" to="/signup">
          Sign Up
        </Link>
      </div>
    </section>
  )
}
