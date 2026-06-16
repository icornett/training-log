import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export const SignupPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { currentUser, refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [gdprConsentAccepted, setGdprConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentUser) {
      navigate('/training_log/1/workouts', { replace: true })
    }
  }, [currentUser, navigate])

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)

    try {
      await api.signup({ username, password, gdprConsentAccepted })
      await refresh()
      navigate('/training_log/1/workouts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to signup')
    }
  }

  return (
    <section className="card auth-card">
      <h1>Signup</h1>
      <p>Create a new account and start logging sessions.</p>
      <form onSubmit={submit} className="stack-form">
        <label htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <label htmlFor="signup-gdpr-consent" className="checkbox-row">
          <input
            id="signup-gdpr-consent"
            type="checkbox"
            checked={gdprConsentAccepted}
            onChange={(event) => setGdprConsentAccepted(event.target.checked)}
            required
          />
          I agree to the privacy notice and data processing terms.
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">Create Account</button>
      </form>
    </section>
  )
}
