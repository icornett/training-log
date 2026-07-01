import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { LEAGUES, TEAM_OPTIONS, type League } from '../constants/teamCatalog'
import { useAuth } from '../context/AuthContext'

const DEFAULT_TEAM_KEY = 'nfl:seahawks'

const leagueFromTeamKey = (teamKey: string | null | undefined): League => {
  const prefix = teamKey?.split(':')[0]?.toUpperCase()
  if (prefix === 'NFL' || prefix === 'MLB' || prefix === 'MLS' || prefix === 'NHL' || prefix === 'NBA') {
    return prefix
  }
  return 'NFL'
}

export const AccountSettingsPage = (): JSX.Element => {
  const navigate = useNavigate()
  const { pageNumber = '1' } = useParams()
  const { currentUser, exportAccountData, deleteAccount, logout, updateFavoriteTeam } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<League>(
    leagueFromTeamKey(currentUser?.favoriteTeamKey ?? DEFAULT_TEAM_KEY),
  )
  const [selectedTeamKey, setSelectedTeamKey] = useState<string>(
    currentUser?.favoriteTeamKey ?? DEFAULT_TEAM_KEY,
  )

  useEffect(() => {
    const nextTeamKey = currentUser?.favoriteTeamKey ?? DEFAULT_TEAM_KEY
    setSelectedTeamKey(nextTeamKey)
    setSelectedLeague(leagueFromTeamKey(nextTeamKey))
  }, [currentUser?.favoriteTeamKey])

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

  const teamsForLeague = TEAM_OPTIONS.filter((team) => team.league === selectedLeague).sort((left, right) =>
    left.label.localeCompare(right.label),
  )

  const handleLeagueChange = (league: League): void => {
    setSelectedLeague(league)
    const firstTeam = TEAM_OPTIONS.filter((team) => team.league === league).sort((left, right) =>
      left.label.localeCompare(right.label),
    )[0]
    if (firstTeam) {
      setSelectedTeamKey(firstTeam.key)
    }
  }

  return (
    <section className="card">
      <h1>Account Settings</h1>
      <p>Manage privacy rights, exports, and account lifecycle controls.</p>

      <div className="panel-block">
        <h2>Favorite Team Theme</h2>
        <p>
          Choose your favorite team to theme the app with league-inspired colors. This is where you can adjust
          the theme you received at first login.
        </p>
        <label htmlFor="favorite-team-league">League</label>
        <select
          id="favorite-team-league"
          value={selectedLeague}
          onChange={(e) => handleLeagueChange(e.target.value as League)}
        >
          {LEAGUES.map((league) => (
            <option key={league} value={league}>
              {league}
            </option>
          ))}
        </select>
        <label htmlFor="favorite-team-select">Favorite Team</label>
        <select
          id="favorite-team-select"
          value={selectedTeamKey}
          onChange={(e) => {
            setSelectedTeamKey(e.target.value)
            void handleTeamChange(e.target.value)
          }}
        >
          {teamsForLeague.map((team) => (
            <option key={team.key} value={team.key}>
              {team.label}
            </option>
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
