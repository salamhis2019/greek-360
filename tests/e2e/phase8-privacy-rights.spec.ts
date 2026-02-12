import { expect, test, type Page } from '@playwright/test'

interface TestSession {
  isAuthenticated: boolean
  userId: string | null
  phoneE164: string | null
  displayName: string | null
  needsOnboarding: boolean
  roles: string[]
}

const setInitialSession = async (page: Page, session: TestSession) => {
  await page.addInitScript((nextSession) => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(nextSession))
  }, session)
}

test('privacy settings supports export and deletion request re-auth flow', async ({ page }) => {
  await setInitialSession(page, {
    isAuthenticated: true,
    userId: 'phase8-e2e-student',
    phoneE164: '+14155556001',
    displayName: 'Phase 8 E2E Student',
    needsOnboarding: false,
    roles: ['student'],
  })

  await page.goto('/settings/privacy')
  await expect(page.getByRole('heading', { name: /privacy settings/i })).toBeVisible()

  await page.getByRole('button', { name: /generate export package/i }).click()
  await expect(page.getByText(/export package generated/i)).toBeVisible()

  await page.getByLabel(/one-time passcode/i).fill('000000')
  await page.getByRole('button', { name: /request account deletion/i }).click()
  await expect(page.getByText(/verification code is invalid/i)).toBeVisible()

  await page.getByLabel(/one-time passcode/i).fill('123456')
  await page.getByRole('button', { name: /request account deletion/i }).click()
  await expect(page.getByText(/deletion request submitted/i)).toBeVisible()
  await expect(page.getByText(/current request status: requested/i)).toBeVisible()
})
