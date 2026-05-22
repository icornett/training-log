import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { WorkoutDetails } from '../types/domain'
import { WorkoutDetailPage } from './WorkoutDetailPage'

vi.mock('../services/api', () => ({
  api: {
    getWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const workoutFixture: WorkoutDetails = {
  id: 1,
  name: 'Upper Body',
  date: '2026-05-15',
  username: 'Jane Doe',
  numSets: 4,
  numReps: 8,
  weightDescription: '95 lbs',
  exercises: [
    {
      id: 11,
      description: 'Bench Press',
      numSets: 3,
      numReps: 8,
      weightDescription: '65 lbs',
    },
  ],
}

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/training_log/1/workouts/1']}>
      <Routes>
        <Route path="/training_log/:pageNumber/workouts/:workoutId" element={<WorkoutDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WorkoutDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { username: 'Jane Doe' },
      loading: false,
      refresh: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
    })
    vi.mocked(api.getWorkout).mockResolvedValue(workoutFixture)
  })

  it('submits workout edits for the owner', async () => {
    const updatedWorkout: WorkoutDetails = { ...workoutFixture, name: 'Upper Strength' }
    vi.mocked(api.updateWorkout).mockResolvedValue(updatedWorkout)

    renderPage()

    await screen.findByRole('heading', { name: 'Upper Body' })
    await userEvent.click(screen.getByRole('button', { name: 'Edit Workout' }))

    const workoutName = screen.getByLabelText('Workout Name')
    await userEvent.clear(workoutName)
    await userEvent.type(workoutName, 'Upper Strength')
    await userEvent.click(screen.getByRole('button', { name: 'Save Workout' }))

    await waitFor(() => {
      expect(api.updateWorkout).toHaveBeenCalledWith({
        id: 1,
        name: 'Upper Strength',
        date: '2026-05-15',
        numSets: 4,
        numReps: 8,
        weightDescription: '95 lbs',
      })
    })
    expect(await screen.findByText('Workout updated.')).toBeInTheDocument()
  })

  it('creates a new exercise for the owner', async () => {
    const updatedWorkout: WorkoutDetails = {
      ...workoutFixture,
      exercises: [
        ...workoutFixture.exercises,
        {
          id: 12,
          description: 'Pull Ups',
          numSets: 4,
          numReps: 10,
          weightDescription: 'bodyweight',
        },
      ],
    }
    vi.mocked(api.createExercise).mockResolvedValue(updatedWorkout)

    renderPage()

    await screen.findByRole('heading', { name: 'Upper Body' })

    await userEvent.clear(screen.getByLabelText('Description'))
    await userEvent.type(screen.getByLabelText('Description'), 'Pull Ups')
    await userEvent.clear(screen.getByLabelText('Sets'))
    await userEvent.type(screen.getByLabelText('Sets'), '4')
    await userEvent.clear(screen.getByLabelText('Reps'))
    await userEvent.type(screen.getByLabelText('Reps'), '10')
    await userEvent.clear(screen.getByLabelText('Weight'))
    await userEvent.type(screen.getByLabelText('Weight'), 'bodyweight')
    await userEvent.click(screen.getByRole('button', { name: 'Add Exercise' }))

    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(1, {
        description: 'Pull Ups',
        numSets: 4,
        numReps: 10,
        weightDescription: 'bodyweight',
      })
    })
    expect(await screen.findByText('Exercise added.')).toBeInTheDocument()
  })
})