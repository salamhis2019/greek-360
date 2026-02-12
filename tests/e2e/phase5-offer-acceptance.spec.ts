import { expect, test, type Page } from '@playwright/test'

const writeSession = async (
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
  await page.evaluate((nextSession) => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(nextSession))
    window.__greek360SetSession?.(nextSession)
  }, session)
}

const setInitialSession = async (
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

const navigateInApp = async (page: Page, path: string) => {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

const submitInterestAsStudent = async (page: Page, studentUserId: string, joinCode: string) => {
  await writeSession(page, {
    isAuthenticated: true,
    userId: studentUserId,
    phoneE164: '+14155550111',
    displayName: studentUserId,
    needsOnboarding: false,
    roles: ['student'],
  })

  await navigateInApp(page, '/home')
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()
  await navigateInApp(page, `/join/${joinCode}`)
  await expect(page.getByRole('heading', { name: /join a chapter/i })).toBeVisible()
  await page.getByRole('button', { name: /i'm interested/i }).click()
  await expect(page.getByRole('heading', { name: /interest submitted/i })).toBeVisible()
}

test('offer accept and decline outcomes update UI membership states', async ({ page }) => {
  await setInitialSession(page, {
    isAuthenticated: true,
    userId: 'super-admin-user',
    phoneE164: '+14155550123',
    displayName: 'Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await page.goto('/super/universities')
  await page.getByLabel('University name').fill('Phase Five University')
  await page.getByLabel('University slug').fill('phase-five-university')
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText('Phase Five University')).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await page.getByLabel('Organization name').fill('Phase Five Chapter')
  await page.getByLabel('Organization slug').fill('phase-five-chapter')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText('Phase Five Chapter')).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'fall 2026' })).toBeVisible()

  await page.getByLabel('Join code').fill('P5FLOW26')
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText('Code: P5FLOW26')).toBeVisible()

  await submitInterestAsStudent(page, 'phase5-student-accept', 'P5FLOW26')
  await submitInterestAsStudent(page, 'phase5-student-decline', 'P5FLOW26')

  await writeSession(page, {
    isAuthenticated: true,
    userId: 'super-admin-user',
    phoneE164: '+14155550123',
    displayName: 'Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await navigateInApp(page, '/super/cycles')
  await page.getByRole('link', { name: /open stage 1/i }).first().click()
  await expect(page.getByRole('heading', { name: /stage 1 queue/i })).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase5-student-accept' })
    .getByRole('button', { name: 'Shortlist' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase5-student-decline' })
    .getByRole('button', { name: 'Shortlist' })
    .click()

  await page.getByRole('link', { name: /^stage 2$/i }).click()
  await expect(page.getByRole('heading', { name: /stage 2 decisions/i })).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase5-student-accept' })
    .getByRole('button', { name: 'Final Yes' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase5-student-decline' })
    .getByRole('button', { name: 'Final Yes' })
    .click()

  await writeSession(page, {
    isAuthenticated: true,
    userId: 'phase5-student-accept',
    phoneE164: '+14155550901',
    displayName: 'phase5-student-accept',
    needsOnboarding: false,
    roles: ['student'],
  })

  await navigateInApp(page, '/home')
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()
  await navigateInApp(page, '/offers')
  await expect(page.getByRole('heading', { name: /offers inbox/i })).toBeVisible()
  await expect(page.getByText(/status: pending/i)).toBeVisible()
  await page.getByRole('button', { name: /^accept$/i }).click()
  await page.getByRole('button', { name: /confirm accept/i }).click()
  await expect(page.getByText(/status: accepted/i)).toBeVisible()
  await expect(page.getByText(/membership active/i)).toBeVisible()

  await navigateInApp(page, '/profile')
  await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible()
  await expect(page.getByText(/active membership/i)).toBeVisible()

  await navigateInApp(page, '/directory')
  await expect(page.getByRole('heading', { name: /directory/i })).toBeVisible()
  await expect(page.getByText(/your membership status/i)).toBeVisible()
  await expect(page.getByText(/active/i)).toBeVisible()

  await writeSession(page, {
    isAuthenticated: true,
    userId: 'phase5-student-decline',
    phoneE164: '+14155550902',
    displayName: 'phase5-student-decline',
    needsOnboarding: false,
    roles: ['student'],
  })

  await navigateInApp(page, '/home')
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()
  await navigateInApp(page, '/offers')
  await expect(page.getByText(/status: pending/i)).toBeVisible()
  await page.getByRole('button', { name: /^decline$/i }).click()
  await page.getByRole('button', { name: /confirm decline/i }).click()
  await expect(page.getByText(/status: declined/i)).toBeVisible()

  await navigateInApp(page, '/profile')
  await expect(page.getByText(/no active memberships yet/i)).toBeVisible()
})
