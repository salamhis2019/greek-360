import { expect, test } from '@playwright/test'

test('student can complete onboarding on mobile and keep session after refresh', async ({ page }) => {
  await page.goto('/auth')

  await page.getByLabel('Phone number').fill('(415) 555-0123')
  await page.getByRole('button', { name: 'Send code' }).click()

  await expect(page.getByLabel('Verification code')).toBeVisible()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: 'Verify code' }).click()

  await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible()
  await page.getByLabel('Display name').fill('Alex Student')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Student home' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Student home' })).toBeVisible()
})
