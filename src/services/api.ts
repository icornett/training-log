import type {
  Credentials,
  ExerciseInput,
  ExerciseUpdateInput,
  SessionUser,
  WorkoutCreateInput,
  WorkoutDetails,
  WorkoutListItem,
  WorkoutUpdateInput,
} from '../types/domain'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const body = (await response.json()) as { error?: string; message?: string }
      message = body.error ?? body.message ?? message
    } catch {
      // Ignore non-json error responses.
    }

    throw new ApiError(response.status, message)
  }

  return (await response.json()) as T
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  })
  return parseJson<T>(response)
}

export const api = {
  async login(payload: Credentials): Promise<void> {
    if (payload.username.trim().length === 0 || payload.password.length < 10) {
      throw new Error('Please enter a username and a password with at least 10 characters.')
    }

    await request<void>('/api/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
  },

  async signup(payload: Credentials): Promise<void> {
    if (payload.username.trim().length === 0 || payload.password.length < 10) {
      throw new Error('Please enter a unique username and a password with at least 10 characters.')
    }

    await request<void>('/api/signup', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
  },

  async getCurrentUser(): Promise<SessionUser | null> {
    try {
      return await request<SessionUser>('/api/account')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null
      }

      throw error
    }
  },

  async logout(): Promise<void> {
    await request<void>('/api/logout', {
      method: 'POST',
    })
  },

  async deleteAccount(): Promise<void> {
    await request<void>('/api/account', {
      method: 'DELETE',
    })
  },

  async listWorkouts(pageNumber: number): Promise<{ items: WorkoutListItem[]; totalPages: number }> {
    const response = await request<{ items: WorkoutListItem[]; totalPages: number }>(
      `/api/workouts?page=${pageNumber}`,
    )
    return {
      items: response.items.map((item) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        username: item.username,
        numSets: item.numSets,
        numReps: item.numReps,
        weightDescription: item.weightDescription,
      })),
      totalPages: response.totalPages,
    }
  },

  async getWorkout(id: number): Promise<WorkoutDetails | null> {
    return await request<WorkoutDetails>(`/api/workouts/${id}`)
  },

  async createWorkout(payload: WorkoutCreateInput): Promise<WorkoutDetails> {
    const created = await request<{ id: number; message: string }>('/api/workouts', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })

    const workout = await request<WorkoutDetails>(`/api/workouts/${created.id}`)
    return workout
  },

  async updateWorkout(payload: WorkoutUpdateInput): Promise<WorkoutDetails> {
    await request<{ message: string }>(`/api/workouts/${payload.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: payload.name,
        date: payload.date,
      }),
    })

    return await request<WorkoutDetails>(`/api/workouts/${payload.id}`)
  },

  async deleteWorkout(workoutId: number): Promise<void> {
    await request<{ message: string }>(`/api/workouts/${workoutId}`, {
      method: 'DELETE',
    })
  },

  async createExercise(workoutId: number, payload: ExerciseInput): Promise<WorkoutDetails> {
    await request<{ id: number; message: string }>(`/api/workouts/${workoutId}/exercises`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })

    return await request<WorkoutDetails>(`/api/workouts/${workoutId}`)
  },

  async updateExercise(payload: ExerciseUpdateInput): Promise<WorkoutDetails> {
    await request<{ message: string }>(
      `/api/workouts/${payload.workoutId}/exercises/${payload.exerciseId}`,
      {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          description: payload.description,
          exerciseType: payload.exerciseType,
          numSets: payload.numSets,
          numReps: payload.numReps,
          weightDescription: payload.weightDescription,
          durationMinutes: payload.durationMinutes,
          speedMph: payload.speedMph,
          notes: payload.notes,
        }),
      },
    )

    return await request<WorkoutDetails>(`/api/workouts/${payload.workoutId}`)
  },

  async deleteExercise(workoutId: number, exerciseId: number): Promise<WorkoutDetails> {
    await request<{ message: string }>(`/api/workouts/${workoutId}/exercises/${exerciseId}`, {
      method: 'DELETE',
    })

    return await request<WorkoutDetails>(`/api/workouts/${workoutId}`)
  },
}
