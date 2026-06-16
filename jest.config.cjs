module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/api'],
  testMatch: ['**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/api/tsconfig.json',
      },
    ],
  },
  // Scope coverage to the tested handler files only.
  // Shared utilities (db, repository, auth) require a real DB and are covered by integration tests.
  collectCoverageFrom: [
    'api/functions/account.ts',
    'api/functions/login.ts',
    'api/functions/workouts.ts',
    'api/functions/workoutWithExercise.ts',
  ],
  coverageThreshold: {
    global: { lines: 90, branches: 70, functions: 78, statements: 90 },
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'test-results', outputName: 'api-junit.xml' }],
  ],
}

