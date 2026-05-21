import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export const AppShell = (): JSX.Element => {
  const navigate = useNavigate()
  const { currentUser, loading, logout, deleteAccount } = useAuth()

  const handleLogout = async (): Promise<void> => {
    await logout()
    navigate('/login')
  }

  const handleDeleteAccount = async (): Promise<void> => {
    await deleteAccount()
    navigate('/signup')
  }

  return (
    <div className="app-bg">
      <header className="top-nav">
        <Link className="brand" to="/training_log/1/workouts">
          Training Log
        </Link>
        <nav className="nav-links">
          <Link to="/training_log/1/workouts">Workouts</Link>
          {loading ? null : currentUser ? (
            <>
              <span className="nav-identity">{currentUser.username}</span>
              <button type="button" className="ghost-button" onClick={handleLogout}>
                Logout
              </button>
              <button type="button" className="ghost-button danger-button" onClick={handleDeleteAccount}>
                Delete Account
              </button>
            </>
          ) : (
            <>
              <Link to="/signup">Signup</Link>
              <Link to="/login">Login</Link>
            </>
          )}
        </nav>
      </header>
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}
