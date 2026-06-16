import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export const AccountSettingsPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { pageNumber = '1' } = useParams()
  const { currentUser, exportAccountData, deleteAccount, logout } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const download = async (format: 'json' | 'csv'): Promise<void> => {
    setError(null)
    setStatus('Preparing export...')

    try {
      const payload = await exportAccountData(format)
      const blob = new Blob([payload], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `training-log-export.${format}`
      link.click()
      URL.revokeObjectURL(url)
      setStatus(`Exported account data as ${format.toUpperCase()}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export account data')
      setStatus(null)
    }
  }

  const handleDelete = async (): Promise<void> => {
    const confirmed = window.confirm(
      'Delete your account? You can restore it for up to 30 days before permanent purge.',
    )
    if (!confirmed) {
      return
    }

    setError(null)
    await deleteAccount()
    navigate('/signup')
  }

  const handleLogout = async (): Promise<void> => {
    await logout()
    navigate('/login')
  }

  return (
    <section className="card">
      <h1>Account Settings</h1>
      <p>Manage privacy rights, exports, and account lifecycle controls.</p>

      <div className="panel-block">
        <h2>Data Export</h2>
        <p>Download all workouts and exercises linked to {currentUser?.username ?? 'your account'}.</p>
        <div className="row-actions">
          <button type="button" onClick={() => void download('json')}>
            Export JSON
          </button>
          <button type="button" onClick={() => void download('csv')}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="panel-block">
        <h2>Privacy Notice</h2>
        <p>
          Consent is recorded at signup with policy version tracking. If you request deletion, your account is
          soft-deleted and scheduled for purge after 30 days.
        </p>
      </div>

      <div className="panel-block">
        <h2>Danger Zone</h2>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Logout
          </button>
          <button type="button" className="ghost-button danger-button" onClick={handleDelete}>
            Delete Account
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate(`/training_log/${pageNumber}/workouts`)}
          >
            Back to Workouts
          </button>
        </div>
      </div>

      {status ? <p className="success-text">{status}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}
