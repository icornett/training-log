import { invalidExerciseEditMessage } from './validation.js'

describe('invalidExerciseEditMessage', () => {
  it('returns null for a valid exercise edit payload', () => {
    expect(invalidExerciseEditMessage('Bench Press', '65 lbs')).toBeNull()
  })

  it('returns an error when the description is too short', () => {
    expect(invalidExerciseEditMessage('Row', '65 lbs')).toContain('Invalid exercise entry.')
  })

  it('returns an error when the weight description uses an unsupported unit', () => {
    expect(invalidExerciseEditMessage('Bench Press', '65 stones')).toContain('Invalid exercise entry.')
  })
})
