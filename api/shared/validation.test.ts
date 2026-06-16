import { invalidExerciseEditMessage } from './validation.js'

describe('invalidExerciseEditMessage', () => {
  it('returns null for a valid strength exercise edit payload', () => {
    expect(invalidExerciseEditMessage('Bench Press', '65 lbs', 'strength')).toBeNull()
  })

  it('returns null for a valid strength exercise with comma-separated weights', () => {
    expect(invalidExerciseEditMessage('Bicep Curls', '25, 20, 15 lbs', 'strength')).toBeNull()
  })

  it('returns null for a valid cardio exercise without weight validation', () => {
    expect(invalidExerciseEditMessage('Treadmill Run', '', 'cardio')).toBeNull()
  })

  it('returns an error when the description is too short', () => {
    expect(invalidExerciseEditMessage('Row', '65 lbs', 'strength')).toContain('Invalid exercise entry.')
  })

  it('returns an error when the weight description uses an unsupported unit for strength', () => {
    expect(invalidExerciseEditMessage('Bench Press', '65 stones', 'strength')).toContain('Invalid exercise entry.')
  })

  it('returns null for bodyweight exercises', () => {
    expect(invalidExerciseEditMessage('Pull Ups', 'bodyweight', 'strength')).toBeNull()
  })

  it('accepts kg unit alias for metric strength exercises', () => {
    expect(invalidExerciseEditMessage('Back Squat', '100 kg', 'strength')).toBeNull()
  })

  it('accepts lb unit alias for imperial strength exercises', () => {
    expect(invalidExerciseEditMessage('Bench Press', '185 lb', 'strength')).toBeNull()
  })
})
