import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

const TEAM_OPTIONS = [
  { league: 'NFL', key: 'nfl:seahawks', label: 'Seattle Seahawks' },
  { league: 'MLB', key: 'mlb:mariners', label: 'Seattle Mariners' },
  { league: 'MLS', key: 'mls:sounders', label: 'Seattle Sounders FC' },
  { league: 'NHL', key: 'nhl:kraken', label: 'Seattle Kraken' },
  { league: 'NBA', key: 'nba:supersonics', label: 'Seattle SuperSonics' },
] as const

const LEAGUES = ['NFL', 'MLB', 'MLS', 'NHL', 'NBA'] as const

export const AccountSettingsPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { pageNumber = '1' } = useParams()
  const { currentUser, exportAccountData, deleteAccount, logout, updateFavoriteTeam } = useAuth()
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

  const handleTeamChange = async (teamKey: string): Promise<void> => {
    setError(null)
    try {
      await updateFavoriteTeam(teamKey)
      setStatus('Team theme updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update team preference')
    }
  }

  return (
    <section className="card">
      <h1>Account Settings</h1>
      <p>Manage privacy rights, exports, and account lifecycle controls.</p>

      <div className="panel-block">
        <h2>Favorite Team Theme</h2>
        <p>Choose your Seattle team to theme the app with their colors.</p>
        <label htmlFor="favorite-team-select">Favorite Team</label>
        <select
          id="favorite-team-select"
          value={currentUser?.favoriteTeamKey ?? 'nfl:seahawks'}
          onChange={(e) => void handleTeamChange(e.target.value)}
        >
          {LEAGUES.map((league) => (
            <optgroup key={league} label={league}>
              {TEAM_OPTIONS.filter((t) => t.league === league).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

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
