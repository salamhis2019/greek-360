import { expect, test } from '@playwright/test'
import { TEST_IDS } from '../../src/app/testing/testIds'

test('student can complete onboarding on mobile and keep session after refresh', async ({ page }) => {
  const projectTag = test.info().project.name.includes('mobile') ? '92' : '91'
  const phoneNumber = `(415) 555-01${projectTag}`

  await page.addInitScript(() => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
  })

  await page.goto('/auth')

  await page.getByLabel('Phone number').fill(phoneNumber)
  await page.getByRole('button', { name: 'Send code' }).click()

  await expect(page.getByLabel('Verification code')).toBeVisible()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: 'Verify code' }).click()

  await expect(page.getByTestId(TEST_IDS.auth.stepProfile)).toBeVisible()
  await page.getByLabel('Display name').fill('Alex Student')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()

  await page.reload()
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()
})
