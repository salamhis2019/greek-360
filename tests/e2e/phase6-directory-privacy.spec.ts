import { expect, test, type Page } from '@playwright/test'

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
  await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible()
  await page.getByLabel('Phone number').fill(phone)
  await page.getByRole('button', { name: /send code/i }).click()

  await expect(page.getByRole('heading', { name: /verify your code/i })).toBeVisible()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: /verify code/i }).click()

  await expect(page.getByRole('heading', { name: /complete your profile/i })).toBeVisible()
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()

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
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()
  await navigateInApp(page, `/join/${joinCode}`)
  await expect(page.getByRole('heading', { name: /join a chapter/i })).toBeVisible()
  await page.getByRole('button', { name: /i'm interested/i }).click()
  await expect(page.getByRole('heading', { name: /interest submitted/i })).toBeVisible()
}

const processStageFlow = async (
  page: Page,
  organizationName: string,
  candidateNames: string[]
) => {
  await navigateInApp(page, '/super/cycles')
  await expect(page.getByRole('heading', { name: /recruitment cycles/i })).toBeVisible()
  await page
    .getByRole('listitem')
    .filter({ hasText: organizationName })
    .getByRole('link', { name: /open stage 1/i })
    .click()

  await expect(page.getByRole('heading', { name: /stage 1 queue/i })).toBeVisible()
  for (const candidateName of candidateNames) {
    await page
      .getByRole('listitem')
      .filter({ hasText: candidateName })
      .getByRole('button', { name: /^shortlist$/i })
      .click()
  }

  await page.getByRole('link', { name: /^stage 2$/i }).click()
  await expect(page.getByRole('heading', { name: /stage 2 decisions/i })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()
  await navigateInApp(page, '/offers')
  await expect(page.getByRole('heading', { name: /offers inbox/i })).toBeVisible()
  await page.getByRole('button', { name: /^accept$/i }).click()
  await page.getByRole('button', { name: /confirm accept/i }).click()
  await expect(page.getByText(/status: accepted/i)).toBeVisible()
}

test('directory redacts private fields outside shared chapter memberships', async ({ page }) => {
  await setInitialSession(page, {
    isAuthenticated: true,
    userId: 'phase6-super-admin',
    phoneE164: '+14155554999',
    displayName: 'Phase 6 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await page.goto('/super/universities')

  const actorSession = await onboardStudent(page, '+14155554001', 'Phase6 Actor')
  const sameOrgSession = await onboardStudent(page, '+14155554002', 'Phase6 Same Org')
  const differentOrgSession = await onboardStudent(page, '+14155554003', 'Phase6 Different Org')

  await writeSession(page, {
    isAuthenticated: true,
    userId: 'phase6-super-admin',
    phoneE164: '+14155554999',
    displayName: 'Phase 6 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await navigateInApp(page, '/super/universities')
  await page.getByLabel('University name').fill('Phase Six Directory University')
  await page.getByLabel('University slug').fill('phase-six-directory-university')
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText('Phase Six Directory University')).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await page.getByLabel('Organization name').fill('Phase Six Alpha Org')
  await page.getByLabel('Organization slug').fill('phase-six-alpha-org')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText('Phase Six Alpha Org')).toBeVisible()

  await page.getByLabel('Organization name').fill('Phase Six Beta Org')
  await page.getByLabel('Organization slug').fill('phase-six-beta-org')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText('Phase Six Beta Org')).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await page.locator('#cycle-organization').selectOption({ label: 'Phase Six Alpha Org' })
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Phase Six Alpha Org' })).toBeVisible()

  await page.locator('#cycle-organization').selectOption({ label: 'Phase Six Beta Org' })
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Phase Six Beta Org' })).toBeVisible()

  await page.locator('#join-organization').selectOption({ label: 'Phase Six Alpha Org' })
  await page.getByLabel('Join code').fill('P6E2EALP')
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText('Code: P6E2EALP')).toBeVisible()

  await page.locator('#join-organization').selectOption({ label: 'Phase Six Beta Org' })
  await page.getByLabel('Join code').fill('P6E2EBET')
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText('Code: P6E2EBET')).toBeVisible()

  await submitInterestAsStudent(page, actorSession, 'P6E2EALP')
  await submitInterestAsStudent(page, sameOrgSession, 'P6E2EALP')
  await submitInterestAsStudent(page, differentOrgSession, 'P6E2EBET')

  await writeSession(page, {
    isAuthenticated: true,
    userId: 'phase6-super-admin',
    phoneE164: '+14155554999',
    displayName: 'Phase 6 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await processStageFlow(page, 'Phase Six Alpha Org', [
    actorSession.userId ?? '',
    sameOrgSession.userId ?? '',
  ])
  await processStageFlow(page, 'Phase Six Beta Org', [differentOrgSession.userId ?? ''])

  await acceptOffer(page, actorSession)
  await acceptOffer(page, sameOrgSession)
  await acceptOffer(page, differentOrgSession)

  await writeSession(page, actorSession)
  await navigateInApp(page, '/directory')
  await expect(page.getByRole('heading', { name: /^directory$/i })).toBeVisible()
  await expect(page.getByText('Phase6 Same Org')).toBeVisible()
  await expect(page.getByText('Phase6 Different Org')).toBeVisible()

  const sameOrgCard = page.getByRole('listitem').filter({ hasText: 'Phase6 Same Org' })
  await expect(sameOrgCard.getByText('Phone: +14155554002')).toBeVisible()

  const differentOrgCard = page.getByRole('listitem').filter({ hasText: 'Phase6 Different Org' })
  await expect(differentOrgCard.getByText('Phone: Hidden')).toBeVisible()
  await expect(differentOrgCard.getByText('Email: Hidden')).toBeVisible()
})
