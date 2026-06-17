import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../services/api'
import { WorkoutsPage } from './WorkoutsPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../services/api', () => ({
  api: {
    listWorkouts: vi.fn(),
  },
}))

const renderPage = (initialPath = '/training_log/1/workouts'): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/training_log/:pageNumber/workouts" element={<WorkoutsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WorkoutsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders workout list from API', async () => {
    vi.mocked(api.listWorkouts).mockResolvedValue({
      items: [
        {
          id: 1,
          name: 'Upper Body',
          date: '2026-06-01',
          username: 'Jane Doe',
          numSets: 3,
          numReps: 8,
          weightDescription: 'bodyweight',
        },
      ],
      totalPages: 2,
    })

    renderPage()

    await waitFor(() => {
      expect(api.listWorkouts).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByRole('link', { name: 'Upper Body' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('shows pending sync markers on workout cards', async () => {
    vi.mocked(api.listWorkouts).mockResolvedValue({
      items: [
        {
          id: -101,
          name: 'Offline Legs',
          date: '2026-06-16',
          username: 'Jane Doe',
          numSets: 0,
          numReps: 0,
          weightDescription: 'Pending sync',
          clientId: 'workout-local-1',
          lastSyncedAt: null,
          pendingState: 'pending',
        },
      ],
      totalPages: 1,
    })

    renderPage()

    expect((await screen.findAllByText('Pending sync')).length).toBeGreaterThan(0)
  })

  it('renders empty state when there are no workouts', async () => {
    vi.mocked(api.listWorkouts).mockResolvedValue({ items: [], totalPages: 1 })

    renderPage()

    expect(await screen.findByText('No workouts yet.')).toBeInTheDocument()
  })

  it('redirects invalid page param to page 1', async () => {
    vi.mocked(api.listWorkouts).mockResolvedValue({ items: [], totalPages: 1 })

    renderPage('/training_log/not-a-number/workouts')

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/training_log/1/workouts', { replace: true })
    })
  })
})
