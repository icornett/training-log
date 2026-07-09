import { expect, test } from '@playwright/test'

import { setupSqliteMockApi } from './helpers/sqliteMockApi'
import { getTeamPalette } from '../../src/constants/teamPalettes'

test.beforeEach(async ({ page }) => {
  await setupSqliteMockApi(page, { authenticatedAs: null })
})

test('mobile user can complete core workout workflow', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome to Training Log' })).toBeVisible()
  await page.getByRole('link', { name: 'Sign Up' }).click()

  await page.getByLabel('Username').fill('Workflow User')
  await page.getByLabel('Password').fill('workflow-password-123')
  await page.getByLabel(/I agree to the privacy notice/i).check()
  await page.getByRole('button', { name: 'Create Account' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Workflow User')).toBeVisible()

  await page.getByRole('link', { name: 'Log New Workout' }).click()

  await page.getByLabel('Workout Name').fill('Power Day')
  await page.getByLabel('Workout Date').fill('2026-06-05')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Add your first exercise to save this workout.')).toBeVisible()

  await page.getByLabel('Description').fill('Pull Ups')
  await page.getByLabel('Sets').fill('4')
  await page.locator('#exercise-reps').fill('10')
  await page.getByRole('textbox', { name: 'Weight', exact: true }).fill('bodyweight')
  await page.getByRole('button', { name: 'Add Exercise' }).click()

  await expect(page.getByRole('heading', { name: 'Power Day' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Workout Controls' })).toBeVisible()

  await page.getByLabel('Description').fill('Deadlift')
  await page.getByLabel('Sets').fill('3')
  await page.locator('#exercise-reps').fill('5')
  await page.getByRole('textbox', { name: 'Weight', exact: true }).fill('225 lbs')
  await page.getByRole('button', { name: 'Add Exercise' }).click()
  await expect(page.getByText('Exercise added.')).toBeVisible()

  // Wait for the exercise list to update after the API round-trip on CI.
  const deadliftRow = page.getByRole('listitem').filter({ hasText: 'Deadlift' }).first()
  await expect(deadliftRow).toBeVisible({ timeout: 20_000 })

  await deadliftRow.getByRole('button', { name: /^Edit$/ }).click()
  await expect(page.getByRole('heading', { name: 'Edit Exercise' })).toBeVisible()
  await page.getByLabel('Description').fill('Deadlift Updated')
  await page.getByRole('button', { name: 'Save Exercise' }).click()
  await expect(page.getByText('Exercise updated.')).toBeVisible()

  const updatedDeadliftRow = page.getByRole('listitem').filter({ hasText: 'Deadlift Updated' }).first()
  await expect(updatedDeadliftRow).toBeVisible({ timeout: 20_000 })

  await updatedDeadliftRow.getByRole('button', { name: /^Delete$/ }).click()
  await expect(page.getByText('Exercise deleted.')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Deadlift Updated' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

  await page.getByLabel('Username').fill('Workflow User')
  await page.getByLabel('Password').fill('workflow-password-123')
  await page.getByRole('button', { name: 'Login' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Workflow User')).toBeVisible()
})

test('mobile user can change favorite team theme colors', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Sign Up' }).click()
  await page.getByLabel('Username').fill('Theme User')
  await page.getByLabel('Password').fill('theme-password-123')
  await page.getByLabel(/I agree to the privacy notice/i).check()
  await page.getByRole('button', { name: 'Create Account' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await page.getByRole('link', { name: 'Account' }).click()
  await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible()

  const leagueSelect = page.getByRole('combobox', { name: 'League' })
  const teamSelect = page.getByRole('combobox', { name: 'Favorite Team' })

  await leagueSelect.selectOption('NHL')
  await teamSelect.selectOption('nhl:kraken')
  await expect(page.getByText('Team theme updated.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nhl:kraken')

  const krakenAccent = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  )
  expect(krakenAccent.toLowerCase()).toBe(getTeamPalette('nhl:kraken').accent.toLowerCase())

  await leagueSelect.selectOption('MLB')
  await teamSelect.selectOption('mlb:mariners')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mlb:mariners')

  const marinersAccent = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  )
  expect(marinersAccent.toLowerCase()).toBe(getTeamPalette('mlb:mariners').accent.toLowerCase())
})

test('mobile user can open exercise history from workout details', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('Playwright User')
  await page.getByLabel('Password').fill('playwright-pass-123')
  await page.getByRole('button', { name: 'Login' }).click()

  await page.goto('/training_log/1/workouts/101')

  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible()
  await page.getByRole('link', { name: 'View history for Bench Press' }).click()

  await expect(page).toHaveURL(/\/training_log\/1\/exercise-history\?exercise=Bench(\+|%20)Press$/)
  await expect(page.getByRole('heading', { name: 'Exercise History' })).toBeVisible()
  await expect(page.getByLabel('Exercise name')).toHaveValue('Bench Press')
  await expect(page.getByRole('heading', { name: 'Weight Over Time' })).toBeVisible()
  await expect(page.getByLabel(/Weight trend chart for/i)).toBeVisible()
  await expect(page.getByText('65 lbs - 3 x 8')).toBeVisible()
})

test('mobile user can log per-set weights and see multi-set history details', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('Playwright User')
  await page.getByLabel('Password').fill('playwright-pass-123')
  await page.getByRole('button', { name: 'Login' }).click()

  await page.goto('/training_log/1/workouts/101')

  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible()
  await page.getByLabel('Description').fill('Incline Bench Press')
  await page.getByLabel('Sets').fill('3')
  await page.locator('#exercise-reps').fill('8')
  await page.getByLabel('Set 1 Weight').fill('95')
  await page.getByLabel('Set 2 Weight').fill('85')
  await page.getByLabel('Set 3 Weight').fill('75')

  await page.getByRole('button', { name: 'Add Exercise' }).click()
  await expect(page.getByText('Exercise added.')).toBeVisible()

  const inclineRow = page.getByRole('listitem').filter({ hasText: 'Incline Bench Press' }).first()
  await expect(inclineRow).toBeVisible()
  await inclineRow.getByRole('link', { name: 'View history for Incline Bench Press' }).click()

  await expect(page).toHaveURL(/\/training_log\/1\/exercise-history\?exercise=Incline(\+|%20)Bench(\+|%20)Press$/)
  await expect(page.getByRole('heading', { name: 'Exercise History' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Weight Over Time' })).toBeVisible()
  await expect(page.getByLabel(/Weight trend chart for/i)).toBeVisible()
  await expect(page.getByText('95 lbs, 85 lbs, 75 lbs - 3 x 8')).toBeVisible()
})
