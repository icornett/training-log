import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { currentUser, refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
      await api.login({ username, password })
      await refresh()
      navigate('/training_log/1/workouts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login')
    }
  }

  return (
    <section className="card auth-card">
      <h1>Login</h1>
      <p>Access your workout history and keep progressing.</p>
      <form onSubmit={submit} className="stack-form">
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">Login</button>
      </form>
    </section>
  )
}
