import { expect, test } from '@playwright/test'

test('landing shell renders environment marker', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Greek 360' })).toBeVisible()
  await expect(page.getByTestId('app-environment')).toBeVisible()
})

test('unauthenticated user gets redirected from student home route', async ({ page }) => {
  await page.goto('/home')

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
