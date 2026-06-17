import { expect, test } from '@playwright/test'

import { setupSqliteMockApi } from './helpers/sqliteMockApi'

test.beforeEach(async ({ page }) => {
  await setupSqliteMockApi(page)
})

test('mobile users can reach auth landing page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Playwright User')).toBeVisible()
})

test('mobile users can load workouts from seeded sqlite data', async ({ page }) => {
  await page.goto('/training_log/1/workouts')

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upper Body' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lower Body' })).toBeVisible()
})
