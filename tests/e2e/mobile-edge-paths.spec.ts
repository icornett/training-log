import { expect, test } from '@playwright/test'

import { setupSqliteMockApi } from './helpers/sqliteMockApi'

test.describe('authenticated mobile edge paths', () => {
  test.beforeEach(async ({ page }) => {
    await setupSqliteMockApi(page)
  })

  test('shows not found page for unknown routes and can return to workouts', async ({ page }) => {
    await page.goto('/totally-missing-route')

    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
    await page.getByRole('link', { name: 'Return to workouts' }).click()
    await expect(page).toHaveURL(/\/training_log\/1\/workouts$/)
    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  })

  test('normalizes invalid workouts page number to page 1', async ({ page }) => {
    await page.goto('/training_log/0/workouts')

    await expect(page).toHaveURL(/\/training_log\/1\/workouts$/)
    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  })

  test('redirects pending workout route to new workout page when local state is missing', async ({ page }) => {
    await page.goto('/training_log/1/workouts/pending')

    await expect(page).toHaveURL(/\/training_log\/1\/workouts\/new$/)
    await expect(page.getByRole('heading', { name: 'Log New Workout' })).toBeVisible()
  })

  test('shows workout error for missing workout id', async ({ page }) => {
    await page.goto('/training_log/1/workouts/99999')

    await expect(page.getByRole('heading', { name: 'Workout Error' })).toBeVisible()
    await expect(page.getByText('Workout not found.')).toBeVisible()
  })

  test('allows deleting account and prevents subsequent login', async ({ page }) => {
    await page.goto('/training_log/1/workouts')

    page.on('dialog', (dialog) => {
      void dialog.accept()
    })
    await page.getByRole('link', { name: 'Account' }).click()
    await page.getByRole('button', { name: 'Delete Account' }).click()
    await expect(page.getByRole('heading', { name: 'Signup' })).toBeVisible()

    await page.goto('/login')
    await page.getByLabel('Username').fill('Playwright User')
    await page.getByLabel('Password').fill('playwright-pass-123')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByText('Incorrect login credentials. Please try again.')).toBeVisible()
  })
})

test.describe('unauthenticated mobile auth error paths', () => {
  test.beforeEach(async ({ page }) => {
    await setupSqliteMockApi(page, { authenticatedAs: null })
  })

  test('shows client validation error for short login password', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Username').fill('Playwright User')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByText('Please enter a username and a password with at least 10 characters.')).toBeVisible()
  })

  test('shows server error for invalid login credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Username').fill('Playwright User')
    await page.getByLabel('Password').fill('valid-but-wrong-password')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByText('Incorrect login credentials. Please try again.')).toBeVisible()
  })

  test('shows validation and duplicate errors on signup', async ({ page }) => {
    await page.goto('/signup')

    await page.getByLabel('Username').fill('Brand New User')
    await page.getByLabel('Password').fill('short')
    await page.getByLabel(/I agree to the privacy notice/i).check()
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page.getByText('Please enter a unique username and a password with at least 10 characters.')).toBeVisible()

    await page.getByLabel('Username').fill('Playwright User')
    await page.getByLabel('Password').fill('valid-password-123')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page.getByText('Username already exists.')).toBeVisible()
  })
})
