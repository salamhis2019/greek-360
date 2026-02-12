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

const navigateInApp = async (page: Page, path: string) => {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('admin triage supports rapid decisions and optimistic rollback recovery', async ({ page }) => {
  await setInitialSession(page, {
    isAuthenticated: true,
    userId: 'super-admin-user',
    phoneE164: '+14155550123',
    displayName: 'Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await page.goto('/super/universities')
  await page.getByLabel('University name').fill('Phase Four University')
  await page.getByLabel('University slug').fill('phase-four-university')
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText('Phase Four University')).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await page.getByLabel('Organization name').fill('Phase Four Chapter')
  await page.getByLabel('Organization slug').fill('phase-four-chapter')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText('Phase Four Chapter')).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'fall 2026' })).toBeVisible()

  await page.getByLabel('Join code').fill('P4FLOW26')
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText('Code: P4FLOW26')).toBeVisible()

  await submitInterestAsStudent(page, 'phase4-student-1', 'P4FLOW26')
  await submitInterestAsStudent(page, 'phase4-student-2', 'P4FLOW26')
  await submitInterestAsStudent(page, 'phase4-student-3', 'P4FLOW26')

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
  await expect(page.getByText('phase4-student-1')).toBeVisible()
  await expect(page.getByText('phase4-student-2')).toBeVisible()
  await expect(page.getByText('phase4-student-3')).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase4-student-1' })
    .getByRole('button', { name: 'Shortlist' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase4-student-2' })
    .getByRole('button', { name: 'No' })
    .click()

  await expect(page.getByText('phase4-student-1')).not.toBeVisible()
  await expect(page.getByText('phase4-student-2')).not.toBeVisible()

  await page.evaluate(() => {
    window.sessionStorage.setItem(
      'greek360.test.failNextRecruitmentDecision',
      'Decision write failed. Please retry.'
    )
  })

  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase4-student-3' })
    .getByRole('button', { name: 'Shortlist' })
    .click()

  await expect(page.getByText('Decision write failed. Please retry.')).toBeVisible()
  await expect(page.getByText('phase4-student-3')).toBeVisible()

  await page.getByRole('link', { name: /^stage 2$/i }).click()
  await expect(page.getByRole('heading', { name: /stage 2 decisions/i })).toBeVisible()
  await expect(page.getByText('phase4-student-1')).toBeVisible()
  await expect(page.getByText('phase4-student-2')).not.toBeVisible()
  await expect(page.getByText('phase4-student-3')).not.toBeVisible()
})
