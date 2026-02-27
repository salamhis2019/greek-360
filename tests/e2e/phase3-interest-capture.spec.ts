import { expect, test, type Page } from '@playwright/test'

const setSession = async (
  page: Page,
  session: {
    isAuthenticated: boolean
    userId: string | null
    phoneE164: string | null
    displayName: string | null
    needsOnboarding: boolean
    roles: string[]
  }
) => {
  await page.addInitScript((nextSession) => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(nextSession))
  }, session)
}

test('deep-link join path renders and can hand off unauthenticated users to auth', async ({ page }) => {
  await setSession(page, {
    isAuthenticated: false,
    userId: null,
    phoneE164: null,
    displayName: null,
    needsOnboarding: false,
    roles: [],
  })

  await page.goto('/join/QRJOIN26')

  await expect(page.getByRole('heading', { name: /join a chapter/i })).toBeVisible()
  await expect(page.getByText('QRJOIN26')).toBeVisible()
  await page.getByRole('button', { name: /i'm interested/i }).click()
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
})

test('manual code path can hand off unauthenticated users to auth', async ({ page }) => {
  await setSession(page, {
    isAuthenticated: false,
    userId: null,
    phoneE164: null,
    displayName: null,
    needsOnboarding: false,
    roles: [],
  })

  await page.goto('/code')
  await page.getByLabel('Join code').fill('MANUAL26')
  await page.getByRole('button', { name: /continue/i }).click()

  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
})
