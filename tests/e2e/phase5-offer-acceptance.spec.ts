import { expect, test, type Page } from '@playwright/test'
import { TEST_IDS, TEST_ID_PATTERNS } from '../../src/app/testing/testIds'

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
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()
  await navigateInApp(page, `/join/${joinCode}`)
  await expect(page.getByTestId(TEST_IDS.joinInterest.heading)).toBeVisible()
  await page.getByRole('button', { name: /i'm interested/i }).click()
  await expect(page.getByTestId(TEST_IDS.joinInterest.submittedHeading)).toBeVisible()
}

test('offer accept and decline outcomes update UI membership states', async ({ page }) => {
  const projectTag = test.info().project.name.includes('mobile') ? 'm' : 'd'
  const superAdminUserId = `phase5-super-admin-${projectTag}`
  const universityName = `Phase Five University ${projectTag.toUpperCase()}`
  const universitySlug = `phase-five-university-${projectTag}`
  const organizationName = `Phase Five Chapter ${projectTag.toUpperCase()}`
  const organizationSlug = `phase-five-chapter-${projectTag}`
  const joinCode = `P5${projectTag.toUpperCase()}FLOW`
  const acceptingStudentId = `phase5-student-accept-${projectTag}`
  const decliningStudentId = `phase5-student-decline-${projectTag}`

  await setInitialSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155550123',
    displayName: 'Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await page.goto('/super/universities')
  await page.getByLabel('University name').fill(universityName)
  await page.getByLabel('University slug').fill(universitySlug)
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText(universityName)).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await page.getByLabel('Organization name').fill(organizationName)
  await page.getByLabel('Organization slug').fill(organizationSlug)
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText(organizationName)).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'fall 2026' })).toBeVisible()

  await page.getByLabel('Join code').fill(joinCode)
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText(`Code: ${joinCode}`)).toBeVisible()

  await submitInterestAsStudent(page, acceptingStudentId, joinCode)
  await submitInterestAsStudent(page, decliningStudentId, joinCode)

  await writeSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155550123',
    displayName: 'Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await navigateInApp(page, '/super/cycles')
  await page.getByTestId(TEST_ID_PATTERNS.superCycles.cycleStage1Link).first().click()
  await expect(page.getByTestId(TEST_IDS.recruitment.stage1Heading)).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: acceptingStudentId })
    .getByRole('button', { name: 'Shortlist' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: decliningStudentId })
    .getByRole('button', { name: 'Shortlist' })
    .click()

  await page.getByTestId(TEST_IDS.recruitment.navStage2Link).click()
  await expect(page.getByTestId(TEST_IDS.recruitment.stage2Heading)).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: acceptingStudentId })
    .getByRole('button', { name: 'Final Yes' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: decliningStudentId })
    .getByRole('button', { name: 'Final Yes' })
    .click()

  await writeSession(page, {
    isAuthenticated: true,
    userId: acceptingStudentId,
    phoneE164: '+14155550901',
    displayName: 'phase5-student-accept',
    needsOnboarding: false,
    roles: ['student'],
  })

  await navigateInApp(page, '/home')
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()
  await navigateInApp(page, '/offers')
  await expect(page.getByTestId(TEST_IDS.offers.inboxHeading)).toBeVisible()
  await expect(page.getByText(/^pending$/i).first()).toBeVisible()
  await page.getByRole('button', { name: /^accept$/i }).click()
  await page.getByRole('button', { name: /confirm accept/i }).click()
  await expect(page.getByText(/^accepted$/i).first()).toBeVisible()
  await expect(page.getByText(/membership active/i)).toBeVisible()

  await navigateInApp(page, '/profile')
  await expect(page.getByTestId(TEST_IDS.profile.heading)).toBeVisible()
  await expect(page.getByText(/active membership/i)).toBeVisible()

  await navigateInApp(page, '/directory')
  await expect(page.getByTestId(TEST_IDS.directory.heading)).toBeVisible()
  await expect(page.getByLabel(/search by name or organization/i)).toBeVisible()
  await expect(page.getByText(acceptingStudentId)).toBeVisible()
  await expect(page.getByText(new RegExp(organizationName, 'i'))).toBeVisible()

  await writeSession(page, {
    isAuthenticated: true,
    userId: decliningStudentId,
    phoneE164: '+14155550902',
    displayName: 'phase5-student-decline',
    needsOnboarding: false,
    roles: ['student'],
  })

  await navigateInApp(page, '/home')
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()
  await navigateInApp(page, '/offers')
  await expect(page.getByText(/^pending$/i).first()).toBeVisible()
  await page.getByRole('button', { name: /^decline$/i }).click()
  await page.getByRole('button', { name: /confirm decline/i }).click()
  await expect(page.getByText(/^declined$/i).first()).toBeVisible()

  await navigateInApp(page, '/profile')
  await expect(page.getByText(/no active memberships yet/i)).toBeVisible()
})
