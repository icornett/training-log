import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../services/api'
import type { ExerciseProgressPayload } from '../types/domain'
import { ExerciseHistoryPage } from './ExerciseHistoryPage'

vi.mock('../services/api', () => ({
  api: {
    getExerciseProgress: vi.fn(),
  },
}))

const renderPage = (initialPath = '/training_log/1/exercise-history?exercise=bench press'): void => {
  render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/training_log/:pageNumber/exercise-history" element={<ExerciseHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ExerciseHistoryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('is navigable through the dedicated route', async () => {
    vi.mocked(api.getExerciseProgress).mockResolvedValue({
      exerciseDescription: 'bench press',
      points: [],
      summary: { totalPoints: 0, firstSeenDate: null, lastSeenDate: null },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Exercise History' })).toBeInTheDocument()
  })

  it('renders loading state while fetching', async () => {
    let resolveFetch: (value: ExerciseProgressPayload) => void = () => undefined
    vi.mocked(api.getExerciseProgress).mockImplementation(
      () =>
        new Promise<ExerciseProgressPayload>((resolve) => {
          resolveFetch = resolve
        }),
    )

    renderPage()

    expect(screen.getByText('Loading exercise history...')).toBeInTheDocument()

    resolveFetch({
      exerciseDescription: 'bench press',
      points: [],
      summary: { totalPoints: 0, firstSeenDate: null, lastSeenDate: null },
    })

    await waitFor(() => {
      expect(api.getExerciseProgress).toHaveBeenCalled()
    })
  })

  it('renders error state when fetch fails', async () => {
    vi.mocked(api.getExerciseProgress).mockRejectedValue(new Error('boom'))

    renderPage()

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('renders empty state when no points exist', async () => {
    vi.mocked(api.getExerciseProgress).mockResolvedValue({
      exerciseDescription: 'bench press',
      points: [],
      summary: { totalPoints: 0, firstSeenDate: null, lastSeenDate: null },
    })

    renderPage()

    expect(await screen.findByText('No history available yet for bench press.')).toBeInTheDocument()
  })

  it('renders success page structure for visualization and details', async () => {
    vi.mocked(api.getExerciseProgress).mockResolvedValue({
      exerciseDescription: 'bench press',
      points: [
        {
          workoutId: 1,
          workoutDate: '2026-06-01',
          exerciseDescription: 'bench press',
          numSets: 3,
          numReps: 8,
          weightDescription: '135 lbs',
          durationMinutes: null,
          speedMph: null,
        },
      ],
      summary: { totalPoints: 1, firstSeenDate: '2026-06-01', lastSeenDate: '2026-06-01' },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Weight Over Time' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent History Details' })).toBeInTheDocument()
    expect(screen.getByText('2026-06-01')).toBeInTheDocument()
  })

  it('submits exercise input and refetches for the new query', async () => {
    vi.mocked(api.getExerciseProgress).mockResolvedValue({
      exerciseDescription: 'bench press',
      points: [],
      summary: { totalPoints: 0, firstSeenDate: null, lastSeenDate: null },
    })

    renderPage('/training_log/1/exercise-history')

    await userEvent.type(screen.getByLabelText('Exercise name'), 'squat')
    await userEvent.click(screen.getByRole('button', { name: 'Load History' }))

    await waitFor(() => {
      expect(api.getExerciseProgress).toHaveBeenCalledWith({ exercise: 'squat', limit: 120 })
    })
  })
})
