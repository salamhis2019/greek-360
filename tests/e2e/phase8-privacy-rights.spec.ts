import { expect, test } from '@playwright/test'
import { TEST_IDS } from '../../src/app/testing/testIds'

test('privacy settings supports export and deletion request re-auth flow', async ({ page }) => {
  const projectTag = test.info().project.name.includes('mobile') ? 'm' : 'd'
  const phoneNumber = projectTag === 'm' ? '(415) 555-0692' : '(415) 555-0691'
  const invalidPhoneNumber = projectTag === 'm' ? '(415) 555-0092' : '(415) 555-0091'

  await page.addInitScript(() => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
  })

  await page.goto('/auth')
  await page.getByLabel('Phone number').fill(phoneNumber)
  await page.getByRole('button', { name: /send code/i }).click()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: /verify code/i }).click()
  await expect(page.getByTestId(TEST_IDS.auth.stepProfile)).toBeVisible()
  await page.getByLabel('Display name').fill(`Phase 8 E2E Student ${projectTag.toUpperCase()}`)
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()

  await page.goto('/settings/privacy')
  await expect(page.getByTestId(TEST_IDS.privacy.settingsHeading)).toBeVisible()

  await page.getByRole('button', { name: /generate export package/i }).click()
  await expect(page.getByText(/export package generated/i)).toBeVisible()

  await page.getByTestId(TEST_IDS.privacy.deletePhoneInput).fill(invalidPhoneNumber)
  await page.getByRole('button', { name: /request account deletion/i }).click()
  await expect(page.getByText(/phone number does not match your account/i)).toBeVisible()

  await page.getByTestId(TEST_IDS.privacy.deletePhoneInput).fill(phoneNumber)
  await page.getByRole('button', { name: /request account deletion/i }).click()
  await expect(page.getByText(/deletion request submitted/i)).toBeVisible()
  await expect(page.getByText(/current request status: requested/i)).toBeVisible()
})
