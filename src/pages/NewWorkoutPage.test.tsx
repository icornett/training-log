import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../services/api'
import { NewWorkoutPage } from './NewWorkoutPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../services/api', () => ({
  api: {
    createWorkoutWithExercise: vi.fn(),
  },
}))

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/training_log/1/workouts/new']}>
      <Routes>
        <Route path="/training_log/:pageNumber/workouts/new" element={<NewWorkoutPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NewWorkoutPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    vi.clearAllMocks()
  })

  it('renders workout name and date fields with a Continue to Exercises button', () => {
    renderPage()
    expect(screen.getByLabelText('Workout Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Workout Date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to Exercises' })).toBeInTheDocument()
  })

  it('shows a validation error when name is empty', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Workout Date'), '2026-06-01')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Exercises' }))
    expect(await screen.findByText(/please enter workout name and date/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows a validation error when date is empty', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Workout Name'), 'Legs Day')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Exercises' }))
    expect(await screen.findByText(/please enter workout name and date/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('saves to localStorage and navigates to /pending without calling the API', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Workout Name'), 'Legs Day')
    await userEvent.type(screen.getByLabelText('Workout Date'), '2026-06-01')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Exercises' }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/training_log/1/workouts/pending')
    })

    const stored = JSON.parse(
      localStorage.getItem('trainingLog:pendingWorkout') ?? 'null',
    ) as { name: string; date: string } | null
    expect(stored).toEqual({ name: 'Legs Day', date: '2026-06-01' })
    expect(api.createWorkoutWithExercise).not.toHaveBeenCalled()
  })
})
