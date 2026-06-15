import { expect, test } from '@playwright/test'

test('seeded user can browse the real database', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Username').fill('Playwright User')
  await page.getByLabel('Password').fill('playwright-pass-123')
  await page.getByRole('button', { name: 'Login' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await expect(page.getByText('Playwright User')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Upper Body' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Lower Body' })).toBeVisible()

  const upperBodyRow = page.getByRole('row').filter({ hasText: 'Upper Body' })
  await upperBodyRow.getByRole('link', { name: 'View Workout' }).click()

  await expect(page.getByRole('heading', { name: 'Upper Body' })).toBeVisible()
  await expect(page.getByText('Bench Press')).toBeVisible()
  await expect(page.getByText('Treadmill Warmup')).toBeVisible()
})

test('seeded user can add an exercise in the real database', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Username').fill('Playwright User')
  await page.getByLabel('Password').fill('playwright-pass-123')
  await page.getByRole('button', { name: 'Login' }).click()

  const upperBodyRow = page.getByRole('row').filter({ hasText: 'Upper Body' })
  await upperBodyRow.getByRole('link', { name: 'View Workout' }).click()

  await page.getByLabel('Description').fill('Cable Rows')
  await page.getByLabel('Sets').fill('3')
  await page.getByLabel('Reps').fill('12')
  await page.getByLabel('Weight').fill('70 lbs')
  await page.getByRole('button', { name: 'Add Exercise' }).click()

  await expect(page.getByText('Exercise added.')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Cable Rows' })).toBeVisible()
})