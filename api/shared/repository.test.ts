import { describe, expect, it, jest, beforeEach } from '@jest/globals'

const limit = jest.fn()
const orderBy = jest.fn()
const where = jest.fn(() => ({ orderBy, limit }))
const from = jest.fn(() => ({ where }))
const select = jest.fn(() => ({ from }))

const updateWhere = jest.fn()
const set = jest.fn(() => ({ where: updateWhere }))
const update = jest.fn(() => ({ set }))

jest.unstable_mockModule('./db.js', () => ({
  db: { select, update },
}))

const {
  hasDuplicateExerciseDescription,
  listExercises,
  getUserFavoriteTeam,
  updateUserFavoriteTeam,
} = await import('./repository.js')

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

describe('getUserFavoriteTeam', () => {
  beforeEach(() => {
    limit.mockReset()
    where.mockClear()
    from.mockClear()
    select.mockClear()
  })

  it('returns the team key when the user has a preference set', async () => {
    limit.mockResolvedValue([{ favoriteTeamKey: 'nhl:kraken' }])
    await expect(getUserFavoriteTeam('jane')).resolves.toBe('nhl:kraken')
  })

  it('returns null when the user preference column is null', async () => {
    limit.mockResolvedValue([{ favoriteTeamKey: null }])
    await expect(getUserFavoriteTeam('jane')).resolves.toBeNull()
  })

  it('returns null when the user is not found', async () => {
    limit.mockResolvedValue([])
    await expect(getUserFavoriteTeam('unknown')).resolves.toBeNull()
  })

  it('returns null when favorite_team_key column is unavailable', async () => {
    limit.mockRejectedValue({ code: '42703', message: 'column "favorite_team_key" does not exist' })
    await expect(getUserFavoriteTeam('jane')).resolves.toBeNull()
  })
})

describe('updateUserFavoriteTeam', () => {
  beforeEach(() => {
    updateWhere.mockReset()
    set.mockClear()
    update.mockClear()
  })

  it('persists a valid team key', async () => {
    updateWhere.mockResolvedValue(undefined)
    await expect(updateUserFavoriteTeam('jane', 'nfl:seahawks')).resolves.toBeUndefined()
    expect(set).toHaveBeenCalledWith({ favoriteTeamKey: 'nfl:seahawks' })
  })

  it('rejects an unknown team key without querying the database', async () => {
    await expect(updateUserFavoriteTeam('jane', 'nfl:not-a-team')).rejects.toThrow()
    expect(update).not.toHaveBeenCalled()
  })

  it('accepts valid keys from each supported league', async () => {
    updateWhere.mockResolvedValue(undefined)
    const keys = [
      'nfl:kansas-city-chiefs',
      'mlb:st-louis-cardinals',
      'mls:orlando-city',
      'nhl:vegas-golden-knights',
      'nba:los-angeles-lakers',
      'nba:supersonics',
    ]
    for (const key of keys) {
      await expect(updateUserFavoriteTeam('jane', key)).resolves.toBeUndefined()
    }
  })

  it('gracefully no-ops when favorite_team_key column is unavailable', async () => {
    updateWhere.mockRejectedValue({ code: '42703', message: 'column "favorite_team_key" does not exist' })
    await expect(updateUserFavoriteTeam('jane', 'nfl:seahawks')).resolves.toBeUndefined()
  })
})
