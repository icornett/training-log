import { expect, test } from '@playwright/test'

import { setupSqliteMockApi } from './helpers/sqliteMockApi'

test.beforeEach(async ({ page }) => {
  await setupSqliteMockApi(page, { authenticatedAs: null })
})

test('mobile user can complete core workout workflow', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome to Training Log' })).toBeVisible()
  await page.getByRole('link', { name: 'Sign Up' }).click()

  await page.getByLabel('Username').fill('Workflow User')
  await page.getByLabel('Password').fill('workflow-password-123')
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
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('bodyweight')
  await page.getByRole('button', { name: 'Add Exercise' }).click()

  await expect(page.getByRole('heading', { name: 'Power Day' })).toBeVisible()

  await page.getByLabel('Description').fill('Deadlift')
  await page.getByLabel('Sets').fill('3')
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('225 lbs')
  await page.getByRole('button', { name: 'Add Exercise' }).click()
  await expect(page.locator('strong', { hasText: 'Deadlift' })).toBeVisible()

  await page.getByRole('button', { name: /^Edit$/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit Exercise' })).toBeVisible()
  await page.getByLabel('Description').fill('Deadlift Updated')
  await page.getByRole('button', { name: 'Save Exercise' }).click()
  await expect(page.locator('strong', { hasText: 'Deadlift Updated' })).toBeVisible()

  await page.getByRole('button', { name: /^Delete$/ }).first().click()
  await expect(page.locator('strong', { hasText: 'Deadlift Updated' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

  await page.getByLabel('Username').fill('Workflow User')
  await page.getByLabel('Password').fill('workflow-password-123')
  await page.getByRole('button', { name: 'Login' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Workflow User')).toBeVisible()
})
