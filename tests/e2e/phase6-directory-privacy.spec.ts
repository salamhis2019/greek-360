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

const writeSession = async (page: Page, session: TestSession) => {
  await page.waitForFunction(() => typeof window.__greek360SetSession === 'function')
  await page.evaluate((nextSession) => {
    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(nextSession))
    window.__greek360SetSession?.(nextSession)
  }, session)
}

const setInitialSession = async (page: Page, session: TestSession) => {
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

const onboardStudent = async (page: Page, phone: string, name: string) => {
  await writeSession(page, {
    isAuthenticated: false,
    userId: null,
    phoneE164: null,
    displayName: null,
    needsOnboarding: false,
    roles: [],
  })

  await navigateInApp(page, '/auth')
  await expect(page.getByTestId(TEST_IDS.auth.stepPhone)).toBeVisible()
  await page.getByLabel('Phone number').fill(phone)
  await page.getByRole('button', { name: /send code/i }).click()

  await expect(page.getByTestId(TEST_IDS.auth.stepOtp)).toBeVisible()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: /verify code/i }).click()

  await expect(page.getByTestId(TEST_IDS.auth.stepProfile)).toBeVisible()
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()

  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem('greek360.auth.session')
    if (!raw) {
      throw new Error('Expected auth session in storage.')
    }

    return JSON.parse(raw) as TestSession
  })
}

const submitInterestAsStudent = async (page: Page, session: TestSession, joinCode: string) => {
  await writeSession(page, session)
  await navigateInApp(page, '/home')
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()
  await navigateInApp(page, `/join/${joinCode}`)
  await expect(page.getByTestId(TEST_IDS.joinInterest.heading)).toBeVisible()
  await page.getByRole('button', { name: /i'm interested/i }).click()
  await expect(page.getByTestId(TEST_IDS.joinInterest.submittedHeading)).toBeVisible()
}

const processStageFlow = async (
  page: Page,
  organizationName: string,
  candidateNames: string[]
) => {
  await navigateInApp(page, '/super/cycles')
  await expect(page.getByTestId(TEST_IDS.superAdmin.cyclesHeading)).toBeVisible()
  await page
    .getByRole('listitem')
    .filter({ hasText: organizationName })
    .getByTestId(TEST_ID_PATTERNS.superCycles.cycleStage1Link)
    .click()

  await expect(page.getByTestId(TEST_IDS.recruitment.stage1Heading)).toBeVisible()
  for (const candidateName of candidateNames) {
    await page
      .getByRole('listitem')
      .filter({ hasText: candidateName })
      .getByRole('button', { name: /^shortlist$/i })
      .click()
  }

  await page.getByTestId(TEST_IDS.recruitment.navStage2Link).click()
  await expect(page.getByTestId(TEST_IDS.recruitment.stage2Heading)).toBeVisible()
  for (const candidateName of candidateNames) {
    await page
      .getByRole('listitem')
      .filter({ hasText: candidateName })
      .getByRole('button', { name: /^final yes$/i })
      .click()
  }
}

const acceptOffer = async (page: Page, session: TestSession) => {
  await writeSession(page, session)
  await navigateInApp(page, '/home')
  await expect(page.getByTestId(TEST_IDS.student.homeHeading)).toBeVisible()
  await navigateInApp(page, '/offers')
  await expect(page.getByTestId(TEST_IDS.offers.inboxHeading)).toBeVisible()
  await page.getByRole('button', { name: /^accept$/i }).click()
  await page.getByRole('button', { name: /confirm accept/i }).click()
  await expect(page.getByText(/^accepted$/i).first()).toBeVisible()
}

test('directory redacts private fields outside shared chapter memberships', async ({ page }) => {
  const projectTag = test.info().project.name.includes('mobile') ? 'm' : 'd'
  const superAdminUserId = `phase6-super-admin-${projectTag}`
  const actorName = `Phase6 Actor ${projectTag.toUpperCase()}`
  const sameOrgName = `Phase6 Same Org ${projectTag.toUpperCase()}`
  const differentOrgName = `Phase6 Different Org ${projectTag.toUpperCase()}`
  const universityName = `Phase Six Directory University ${projectTag.toUpperCase()}`
  const universitySlug = `phase-six-directory-university-${projectTag}`
  const alphaOrgName = `Phase Six Alpha Org ${projectTag.toUpperCase()}`
  const alphaOrgSlug = `phase-six-alpha-org-${projectTag}`
  const betaOrgName = `Phase Six Beta Org ${projectTag.toUpperCase()}`
  const betaOrgSlug = `phase-six-beta-org-${projectTag}`
  const alphaJoinCode = `P6${projectTag.toUpperCase()}ALP`
  const betaJoinCode = `P6${projectTag.toUpperCase()}BET`

  await setInitialSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155554999',
    displayName: 'Phase 6 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await page.goto('/super/universities')

  const actorSession = await onboardStudent(page, `+14155554${projectTag === 'm' ? '101' : '001'}`, actorName)
  const sameOrgSession = await onboardStudent(page, `+14155554${projectTag === 'm' ? '102' : '002'}`, sameOrgName)
  const differentOrgSession = await onboardStudent(page, `+14155554${projectTag === 'm' ? '103' : '003'}`, differentOrgName)

  await writeSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155554999',
    displayName: 'Phase 6 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await navigateInApp(page, '/super/universities')
  await page.getByLabel('University name').fill(universityName)
  await page.getByLabel('University slug').fill(universitySlug)
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText(universityName)).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await page.getByLabel('Organization name').fill(alphaOrgName)
  await page.getByLabel('Organization slug').fill(alphaOrgSlug)
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText(alphaOrgName)).toBeVisible()

  await page.getByLabel('Organization name').fill(betaOrgName)
  await page.getByLabel('Organization slug').fill(betaOrgSlug)
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText(betaOrgName)).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await page.locator('#cycle-organization').selectOption({ label: alphaOrgName })
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: alphaOrgName })).toBeVisible()

  await page.locator('#cycle-organization').selectOption({ label: betaOrgName })
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: betaOrgName })).toBeVisible()

  await page.locator('#join-organization').selectOption({ label: alphaOrgName })
  await page.getByLabel('Join code').fill(alphaJoinCode)
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText(`Code: ${alphaJoinCode}`)).toBeVisible()

  await page.locator('#join-organization').selectOption({ label: betaOrgName })
  await page.getByLabel('Join code').fill(betaJoinCode)
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText(`Code: ${betaJoinCode}`)).toBeVisible()

  await submitInterestAsStudent(page, actorSession, alphaJoinCode)
  await submitInterestAsStudent(page, sameOrgSession, alphaJoinCode)
  await submitInterestAsStudent(page, differentOrgSession, betaJoinCode)

  await writeSession(page, {
    isAuthenticated: true,
    userId: superAdminUserId,
    phoneE164: '+14155554999',
    displayName: 'Phase 6 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await processStageFlow(page, alphaOrgName, [
    actorSession.userId ?? '',
    sameOrgSession.userId ?? '',
  ])
  await processStageFlow(page, betaOrgName, [differentOrgSession.userId ?? ''])

  await acceptOffer(page, actorSession)
  await acceptOffer(page, sameOrgSession)
  await acceptOffer(page, differentOrgSession)

  await writeSession(page, actorSession)
  await navigateInApp(page, '/directory')
  await expect(page.getByTestId(TEST_IDS.directory.heading)).toBeVisible()
  await expect(page.getByText(sameOrgName)).toBeVisible()
  await expect(page.getByText(differentOrgName)).toBeVisible()

  const sameOrgCard = page.getByRole('listitem').filter({ hasText: sameOrgName })
  await expect(sameOrgCard.getByText(`Phone: ${sameOrgSession.phoneE164}`)).toBeVisible()

  const differentOrgCard = page.getByRole('listitem').filter({ hasText: differentOrgName })
  await expect(differentOrgCard.getByText('Phone: Hidden')).toBeVisible()
  await expect(differentOrgCard.getByText('Email: Hidden')).toBeVisible()
})
