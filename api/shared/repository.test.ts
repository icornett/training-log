import { describe, expect, it, jest, beforeEach } from '@jest/globals'

const orderBy = jest.fn()
const where = jest.fn(() => ({ orderBy }))
const from = jest.fn(() => ({ where }))
const select = jest.fn(() => ({ from }))

jest.unstable_mockModule('./db.js', () => ({
  db: { select },
}))

const { hasDuplicateExerciseDescription, listExercises } = await import('./repository.js')

describe('listExercises', () => {
  beforeEach(() => {
    orderBy.mockReset()
    where.mockClear()
    from.mockClear()
    select.mockClear()
  })

  it('returns numeric exercise fields as numbers when the driver yields strings', async () => {
    orderBy.mockResolvedValue([
      {
        id: 10,
        description: 'Run',
        numSets: null,
        numReps: null,
        weightDescription: null,
        workoutId: 4,
        exerciseType: 'cardio',
        durationMinutes: '30.5',
        speedMph: '6.2',
        notes: null,
      },
    ])

    await expect(listExercises(4)).resolves.toEqual([
      expect.objectContaining({
        durationMinutes: 30.5,
        speedMph: 6.2,
      }),
    ])
  })
})

describe('hasDuplicateExerciseDescription', () => {
  beforeEach(() => {
    orderBy.mockReset()
    where.mockClear()
    from.mockClear()
    select.mockClear()
  })

  it('returns true for duplicate descriptions ignoring case and spaces', async () => {
    orderBy.mockResolvedValue([
      {
        id: 1,
        description: 'Bench Press',
        numSets: 3,
        numReps: 8,
        weightDescription: '65 lbs',
        workoutId: 7,
        exerciseType: 'strength',
        durationMinutes: null,
        speedMph: null,
        notes: null,
      },
    ])

    await expect(hasDuplicateExerciseDescription(7, '  bench   press  ')).resolves.toBe(true)
  })

  it('ignores the target exercise when excludeExerciseId is provided', async () => {
    orderBy.mockResolvedValue([
      {
        id: 11,
        description: 'Bench Press',
        numSets: 3,
        numReps: 8,
        weightDescription: '65 lbs',
        workoutId: 4,
        exerciseType: 'strength',
        durationMinutes: null,
        speedMph: null,
        notes: null,
      },
      {
        id: 12,
        description: 'Row',
        numSets: 3,
        numReps: 10,
        weightDescription: '70 lbs',
        workoutId: 4,
        exerciseType: 'strength',
        durationMinutes: null,
        speedMph: null,
        notes: null,
      },
    ])

    await expect(
      hasDuplicateExerciseDescription(4, 'bench press', { excludeExerciseId: 11 }),
    ).resolves.toBe(false)
  })
})
