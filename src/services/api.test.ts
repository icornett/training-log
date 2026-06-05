import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from './api'

const jsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('validates login payload before calling API', async () => {
    await expect(api.login({ username: '   ', password: 'short' })).rejects.toThrow(
      'Please enter a username and a password with at least 10 characters.',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls login endpoint for valid payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await api.login({ username: 'Jane Doe', password: 'long-enough-password' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    )
  })

  it('returns null for 401 current user lookup', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))

    await expect(api.getCurrentUser()).resolves.toBeNull()
  })

  it('throws non-401 errors for current user lookup', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Server error' }, 500))

    await expect(api.getCurrentUser()).rejects.toThrow('Server error')
  })

  it('maps workout list response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
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
      }),
    )

    const result = await api.listWorkouts(1)

    expect(fetch).toHaveBeenCalledWith('/api/workouts?page=1', expect.any(Object))
    expect(result.items[0].name).toBe('Upper Body')
    expect(result.totalPages).toBe(2)
  })

  it('creates workout then fetches details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ id: 42, message: 'created' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 42, name: 'Upper Body', exercises: [] }))

    const result = await api.createWorkout({ name: 'Upper Body', date: '2026-06-01' })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/workouts', expect.objectContaining({ method: 'POST' }))
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/workouts/42', expect.any(Object))
    expect(result.id).toBe(42)
  })

  it('updates workout then fetches details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'updated' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Updated Workout', exercises: [] }))

    const result = await api.updateWorkout({ id: 7, name: 'Updated Workout', date: '2026-06-02' })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/workouts/7', expect.objectContaining({ method: 'PUT' }))
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/workouts/7', expect.any(Object))
    expect(result.name).toBe('Updated Workout')
  })

  it('creates exercise then fetches workout details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ id: 88, message: 'created' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Workout', exercises: [{ id: 88 }] }))

    const result = await api.createExercise(7, {
      description: 'Pull Ups',
      exerciseType: 'strength',
      numSets: 4,
      numReps: 10,
      weightDescription: 'bodyweight',
      notes: '',
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/7/exercises',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.exercises).toHaveLength(1)
  })

  it('updates exercise then fetches workout details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'updated' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Workout', exercises: [{ id: 11 }] }))

    const result = await api.updateExercise({
      workoutId: 7,
      exerciseId: 11,
      description: 'Bench Press',
      exerciseType: 'strength',
      numSets: 3,
      numReps: 8,
      weightDescription: '65 lbs',
      durationMinutes: undefined,
      speedMph: undefined,
      notes: '',
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/7/exercises/11',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(result.id).toBe(7)
  })

  it('deletes exercise then fetches workout details', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'deleted' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, name: 'Workout', exercises: [] }))

    const result = await api.deleteExercise(7, 11)

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/workouts/7/exercises/11',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/workouts/7', expect.any(Object))
    expect(result.exercises).toHaveLength(0)
  })
})
