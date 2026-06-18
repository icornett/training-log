import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '../context/AuthContext'
import { AppShell } from './AppShell'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('AppShell sync status', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows offline status and pending sync count for authenticated users', () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: 'Jane Doe' },
      loading: false,
      isOffline: true,
      pendingCount: 2,
      lastSyncError: null,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/training_log/1/workouts']}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="training_log/:pageNumber/workouts" element={<div>Workouts</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('2 pending sync')).toBeInTheDocument()
  })

  it('shows a sync issue badge when the last sync failed', () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: 'Jane Doe' },
      loading: false,
      isOffline: false,
      pendingCount: 1,
      lastSyncError: 'Resolve sync conflicts to continue.',
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
      exportAccountData: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/training_log/1/workouts']}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="training_log/:pageNumber/workouts" element={<div>Workouts</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Sync issue')).toBeInTheDocument()
  })
})