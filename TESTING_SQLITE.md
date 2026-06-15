# SQLite E2E Testing Guide

## Overview

The project now includes SQLite end-to-end tests that allow you to test the full user workflow locally without requiring Azure PostgreSQL infrastructure.

## Test Structure

- **Real-DB tests** (`tests/e2e/real-db/`): Run against a pre-seeded Azure PostgreSQL database in CI/CD pipeline
- **SQLite tests** (`tests/e2e/sqlite/`): Run against a local SQLite database for local development
- **Default tests** (`tests/e2e/mobile-*`): Run on PR with standard setup (excluded real-db and sqlite)

## Running SQLite Tests Locally

### Prerequisites

1. **Ensure you're using SQLite locally** (default for local dev):
   ```bash
   # Check your DATABASE_URL environment
   echo $DATABASE_URL
   # Should be something like: sqlite:./test.db or similar
   ```

2. **Build the frontend**:
   ```bash
   npm run build
   ```

3. **Start the preview server**:
   ```bash
   npm run preview
   ```
   This serves the built frontend on `http://localhost:4173`

### Run the Tests

In a separate terminal:

```bash
# Run all SQLite tests across Chromium, Firefox, and WebKit
npm run test:e2e:sqlite

# Run tests on a specific browser
npx playwright test -c playwright.sqlite.config.ts --project=chromium

# Run a specific test
npx playwright test -c playwright.sqlite.config.ts -g "user can complete a full workflow"

# Run with UI mode for debugging
npx playwright test -c playwright.sqlite.config.ts --ui

# Generate and view the HTML report
npm run test:e2e:sqlite
npx playwright show-report
```

## Test Examples

### User Workflow Test

Tests the full lifecycle: signup → create workout → add exercises → logout → login → verify persistence

```bash
npx playwright test -c playwright.sqlite.config.ts -g "user can complete a full workflow"
```

### Browse Test

Tests workout list browsing and navigation

```bash
npx playwright test -c playwright.sqlite.config.ts -g "user can browse workouts"
```

## How SQLite Tests Work

1. **Isolated test data**: Each test creates its own user and workout data
2. **Automatic cleanup**: `finally` blocks ensure test data is deleted after each test
3. **Unique identifiers**: Test usernames include timestamps to prevent collisions
4. **Self-contained**: Tests don't depend on pre-seeded data

Example:
```typescript
const makeUsername = (projectName: string): string => {
  const projectSlug = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  return `sqlite-${projectSlug}-${String(Date.now()).slice(-4)}`
}
```

## CI/CD Pipeline

- **PR builds**: Run default mobile tests (fast feedback)
- **Infrastructure pipeline** (separate repo): Runs real-db tests against pre-seeded Azure PostgreSQL
- **Local development**: Run SQLite tests before committing

## Troubleshooting

### Test times out on signup

**Issue**: Page doesn't load or signup hangs
**Solution**: Ensure preview server is running (`npm run preview`) on port 4173

### "element not found" errors

**Issue**: Selectors can't find form inputs
**Solution**: This often means the page didn't load. Check:
- Preview server is running
- Frontend was rebuilt (`npm run build`)
- BASE_URL in error message matches your setup

### Tests are slow

**Issue**: Tests take longer than expected
**Solution**: 
- Disable video recording: edit `playwright.sqlite.config.ts` and set `video: 'off'`
- Run in parallel (default is serial for SQLite to avoid DB contention): edit workers in config
- Close other applications consuming disk I/O

## Development Workflow

1. **Make changes** to UI or API
2. **Run unit tests**: `npm run test:web && npm run test:api`
3. **Run SQLite E2E tests**: `npm run test:e2e:sqlite`
4. **Verify behavior** locally in browser: `npm run dev`
5. **Commit and push** - PR will run default mobile tests
6. **After merge** - Infrastructure pipeline runs real-db tests

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/e2e/sqlite/`
2. Follow the pattern: signup/create data → test behavior → cleanup in finally block
3. Use unique identifiers for test data (include timestamp)
4. Run locally: `npm run test:e2e:sqlite`

Example template:
```typescript
import { expect, test, type Page } from '@playwright/test'

const makeUsername = (suffix: string): string => `sqlite-test-${suffix}-${Date.now()}`

test('my new feature works', async ({ page }, testInfo) => {
  const username = makeUsername(testInfo.project.name)
  const password = 'test-password-123'

  try {
    // Setup: create test data
    await page.goto('/signup')
    // ... test steps ...
    
    // Assertions
    await expect(page.getByText('Success message')).toBeVisible()
  } finally {
    // Cleanup: delete test data
    // ... cleanup steps ...
  }
})
```
