import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../services/api'
import { NewWorkoutPage } from './NewWorkoutPage'

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
    createWorkout: vi.fn(),
    createExercise: vi.fn(),
    deleteWorkout: vi.fn(),
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
    vi.resetAllMocks()
  })

  it('does not persist workout while still in draft step', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText('Workout Name'), 'Upper Body')
    await userEvent.type(screen.getByLabelText('Workout Date'), '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Add at least one exercise to save this workout.')).toBeInTheDocument()
    expect(api.createWorkout).not.toHaveBeenCalled()
  })

  it('creates workout only when first exercise is submitted', async () => {
    vi.mocked(api.createWorkout).mockResolvedValue({ id: 99 } as never)
    vi.mocked(api.createExercise).mockResolvedValue({} as never)

    renderPage()

    await userEvent.type(screen.getByLabelText('Workout Name'), 'Upper Body')
    await userEvent.type(screen.getByLabelText('Workout Date'), '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await userEvent.type(screen.getByLabelText('Description'), 'Pull Ups')
    await userEvent.clear(screen.getByLabelText('Sets'))
    await userEvent.type(screen.getByLabelText('Sets'), '4')
    await userEvent.clear(screen.getByLabelText('Reps'))
    await userEvent.type(screen.getByLabelText('Reps'), '10')
    await userEvent.clear(screen.getByLabelText('Weight'))
    await userEvent.type(screen.getByLabelText('Weight'), 'bodyweight')

    await userEvent.click(screen.getByRole('button', { name: 'Save Workout' }))

    await waitFor(() => {
      expect(api.createWorkout).toHaveBeenCalledWith({
        name: 'Upper Body',
        date: '2026-06-05',
      })
      expect(api.createExercise).toHaveBeenCalledWith(99, {
        description: 'Pull Ups',
        exerciseType: 'strength',
        numSets: 4,
        numReps: 10,
        weightDescription: 'bodyweight',
        durationMinutes: undefined,
        speedMph: undefined,
        notes: '',
      })
      expect(navigateMock).toHaveBeenCalledWith('/training_log/1/workouts/99')
    })
  })
})
