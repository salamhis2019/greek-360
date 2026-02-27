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

const navigateInApp = async (page: Page, path: string) => {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('admin triage supports rapid decisions and optimistic rollback recovery', async ({ page }) => {
  const projectTag = test.info().project.name.includes('mobile') ? 'm' : 'd'
  const superAdminUserId = `phase4-super-admin-${projectTag}`
  const universityName = `Phase Four University ${projectTag.toUpperCase()}`
  const universitySlug = `phase-four-university-${projectTag}`
  const organizationName = `Phase Four Chapter ${projectTag.toUpperCase()}`
  const organizationSlug = `phase-four-chapter-${projectTag}`
  const joinCode = `P4${projectTag.toUpperCase()}FLOW`
  const studentOneId = `phase4-student-1-${projectTag}`
  const studentTwoId = `phase4-student-2-${projectTag}`
  const studentThreeId = `phase4-student-3-${projectTag}`

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

  await submitInterestAsStudent(page, studentOneId, joinCode)
  await submitInterestAsStudent(page, studentTwoId, joinCode)
  await submitInterestAsStudent(page, studentThreeId, joinCode)

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
  await expect(page.getByText(studentOneId)).toBeVisible()
  await expect(page.getByText(studentTwoId)).toBeVisible()
  await expect(page.getByText(studentThreeId)).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: studentOneId })
    .getByRole('button', { name: 'Shortlist' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: studentTwoId })
    .getByRole('button', { name: 'No' })
    .click()

  await expect(page.getByText(studentOneId)).not.toBeVisible()
  await expect(page.getByText(studentTwoId)).not.toBeVisible()

  await page.evaluate(() => {
    window.sessionStorage.setItem(
      'greek360.test.failNextRecruitmentDecision',
      'Decision write failed. Please retry.'
    )
  })

  await page
    .getByRole('listitem')
    .filter({ hasText: studentThreeId })
    .getByRole('button', { name: 'Shortlist' })
    .click()

  await expect(page.getByText('Decision write failed. Please retry.')).toBeVisible()
  await expect(page.getByText(studentThreeId)).toBeVisible()

  await page.getByTestId(TEST_IDS.recruitment.navStage2Link).click()
  await expect(page.getByTestId(TEST_IDS.recruitment.stage2Heading)).toBeVisible()
  await expect(page.getByText(studentOneId)).toBeVisible()
  await expect(page.getByText(studentTwoId)).not.toBeVisible()
  await expect(page.getByText(studentThreeId)).not.toBeVisible()
})
