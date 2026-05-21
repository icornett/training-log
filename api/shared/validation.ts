import {
  normalizedExerciseDescriptionsByWorkout,
  uniqueUsernames,
  userExists,
  listWorkouts,
  countWorkouts,
  getWorkoutDetails,
} from './repository.js'

export const validNewUser = async (username: string, password: string): Promise<boolean> => {
  const okLength = username.length <= 25 && password.length <= 25 && password.length > 10
  if (!okLength) {
    return false
  }

  const usernames = await uniqueUsernames()
  return !usernames.includes(username)
}

export const invalidWorkoutMessage = async (
  name: string,
  date: string,
  username: string,
  workoutId: number | null,
): Promise<string | null> => {
  const valid = await validWorkoutDetails(name, date, username, workoutId)
  if (valid) {
    return null
  }

  return (
    'Invalid workout entry. You may only log 1 workout per day and the name of the workout ' +
    'must be within 4 & 15 characters long. Please try again.'
  )
}

const validWorkoutDetails = async (
  name: string,
  date: string,
  username: string,
  workoutId: number | null,
): Promise<boolean> => {
  if (name.length > 15 || name.length < 4) {
    return false
  }

  const totalCount = await countWorkouts()
  const all: Array<{ id: number; name: string; date: string; username: string }> = []

  for (let offset = 0; offset < totalCount; offset += 10) {
    const page = await listWorkouts(offset)
    all.push(...page)
  }

  const filtered = workoutId ? all.filter((workout) => workout.id !== workoutId) : all
  const duplicate = filtered.some((workout) => workout.date === date && workout.username === username)
  return !duplicate
}

export const invalidNewExerciseMessage = async (
  description: string,
  weights: string,
  workoutId: number,
): Promise<string | null> => {
  const invalid = await invalidNewExercise(description, weights, workoutId)
  if (!invalid) {
    return null
  }

  return (
    'Invalid exercise entry. Please ensure you have not already added this particular exercise ' +
    "description to your workout, that your description is between 5 and 40 characters, and " +
    "that the weight description provides a number and either 'kgs' or 'lbs' as the unit, or " +
    "'bodyweight', if no additional weight was used."
  )
}

export const invalidExerciseEditMessage = (
  description: string,
  weights: string,
): string | null => {
  const invalid = invalidExerciseEdit(description, weights)
  if (!invalid) {
    return null
  }

  return (
    'Invalid exercise entry. Please ensure that your description is between 5 and 40 characters, ' +
    "and that the weight description provides a number and either 'kgs' or 'lbs' as the unit, " +
    "or 'bodyweight', if no additional weight was used."
  )
}

const invalidNewExercise = async (
  description: string,
  weights: string,
  workoutId: number,
): Promise<boolean> => {
  const duplicate = await duplicateExercise(description, workoutId)
  return duplicate || invalidExerciseEdit(description, weights)
}

const invalidExerciseEdit = (description: string, weights: string): boolean => {
  return exerciseDescriptionBadLength(description) || exerciseWeightsInvalid(weights)
}

const exerciseDescriptionBadLength = (description: string): boolean => {
  return description.length > 40 || description.length < 5
}

const exerciseWeightsInvalid = (weights: string): boolean => {
  const numsSpace = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' '])
  const allowed = new Set(['lbs', 'kgs', 'bodyweight'])

  const unit = weights
    .split('')
    .filter((char) => !numsSpace.has(char))
    .join('')
    .toLowerCase()

  return weights.length > 10 || !allowed.has(unit)
}

const duplicateExercise = async (description: string, workoutId: number): Promise<boolean> => {
  const scrubbed = description.toLowerCase().replace(/\s+/g, '')
  const existing = await normalizedExerciseDescriptionsByWorkout(workoutId)
  return existing.includes(scrubbed)
}

export const requireExistingUser = async (username: string): Promise<boolean> => {
  return userExists(username)
}

export const requireWorkoutOwnership = async (
  workoutId: number,
  username: string,
): Promise<{ ok: boolean; workoutName?: string }> => {
  const workout = await getWorkoutDetails(workoutId)
  if (!workout) {
    return { ok: false }
  }

  return { ok: workout.username === username, workoutName: workout.name }
}
