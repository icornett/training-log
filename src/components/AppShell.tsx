import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export const AppShell = (): JSX.Element => {
  const navigate = useNavigate()
  const { currentUser, loading, logout, isOffline, pendingCount, lastSyncError } = useAuth()

  const handleLogout = async (): Promise<void> => {
    await logout()
    navigate('/login')
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
              {isOffline ? <span className="nav-status nav-status-offline">Offline</span> : null}
              {pendingCount > 0 ? (
                <span className="nav-status nav-status-pending">{pendingCount} pending sync</span>
              ) : null}
              {lastSyncError ? <span className="nav-status nav-status-conflict">Sync issue</span> : null}
              <span className="nav-identity">{currentUser.username}</span>
              <Link to="/training_log/1/account">Account</Link>
              <button type="button" className="ghost-button" onClick={handleLogout}>
                Logout
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
