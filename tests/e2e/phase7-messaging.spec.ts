import { expect, test, type Page } from '@playwright/test'
import { TEST_IDS, TEST_ID_PATTERNS } from '../../src/app/testing/testIds'

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

const writeSession = async (page: Page, session: TestSession) => {
  await page.evaluate((nextSession) => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(nextSession))
    window.__greek360SetSession?.(nextSession)
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

test('admin sends acceptance and optional rejection messages from composer', async ({ page }) => {
  const projectTag = test.info().project.name.includes('mobile') ? 'm' : 'd'
  const superAdminUserId = `phase7-super-admin-${projectTag}`
  const universityName = `Phase Seven University ${projectTag.toUpperCase()}`
  const universitySlug = `phase-seven-university-${projectTag}`
  const organizationName = `Phase Seven Chapter ${projectTag.toUpperCase()}`
  const organizationSlug = `phase-seven-chapter-${projectTag}`
  const joinCode = `P7${projectTag.toUpperCase()}FLOW`
  const studentYesId = `phase7-student-yes-${projectTag}`
  const studentNoId = `phase7-student-no-${projectTag}`

  await setInitialSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155550123',
    displayName: 'Phase 7 Super Admin',
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

  await submitInterestAsStudent(page, studentYesId, joinCode)
  await submitInterestAsStudent(page, studentNoId, joinCode)

  await writeSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155550123',
    displayName: 'Phase 7 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await navigateInApp(page, '/super/cycles')
  await page.getByTestId(TEST_ID_PATTERNS.superCycles.cycleStage1Link).first().click()
  await expect(page.getByTestId(TEST_IDS.recruitment.stage1Heading)).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: studentYesId })
    .getByRole('button', { name: /shortlist/i })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: studentNoId })
    .getByRole('button', { name: /shortlist/i })
    .click()

  await page.getByTestId(TEST_IDS.recruitment.navStage2Link).click()
  await expect(page.getByTestId(TEST_IDS.recruitment.stage2Heading)).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: studentYesId })
    .getByRole('button', { name: /^final yes$/i })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: studentNoId })
    .getByRole('button', { name: /^final no$/i })
    .click()

  await page.getByTestId(TEST_IDS.recruitment.navMessagesLink).click()
  await expect(page.getByTestId(TEST_IDS.messages.heading)).toBeVisible()

  await page.getByLabel('Template name').fill('Acceptance default')
  await page.getByLabel('Template subject').fill('Welcome {{ name }}')
  await page.getByLabel('Template body').fill('Congrats from {{ organization_name }}')
  await page.getByRole('button', { name: /save template/i }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Acceptance default' }).first()
  ).toBeVisible()

  await page.getByLabel('Message type').selectOption('acceptance')
  await page.getByLabel('Recipient group').selectOption('final_yes_pending_offer')
  await page.getByLabel('Template', { exact: true }).selectOption('Acceptance default')
  await page.getByRole('button', { name: /send message/i }).click()
  await expect(page.getByText(/sent 1 of 1 recipients/i)).toBeVisible()

  await page.getByLabel('Message type').selectOption('rejection')
  await page.getByLabel('Recipient group').selectOption('final_no')
  await page.getByLabel('Use custom message').check()
  await page.getByLabel('Custom subject').fill('Recruitment update')
  await page.getByLabel('Custom body').fill('Thanks for your participation.')
  await page.getByRole('button', { name: /send message/i }).click()
  await expect(page.getByText(/sent 1 of 1 recipients/i)).toBeVisible()
})
