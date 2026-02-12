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
  await expect(page.getByRole('heading', { name: /student home/i })).toBeVisible()
  await navigateInApp(page, `/join/${joinCode}`)
  await expect(page.getByRole('heading', { name: /join a chapter/i })).toBeVisible()
  await page.getByRole('button', { name: /i'm interested/i }).click()
  await expect(page.getByRole('heading', { name: /interest submitted/i })).toBeVisible()
}

test('admin sends acceptance and optional rejection messages from composer', async ({ page }) => {
  await setInitialSession(page, {
    isAuthenticated: true,
    userId: 'phase7-super-admin',
    phoneE164: '+14155550123',
    displayName: 'Phase 7 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await page.goto('/super/universities')
  await page.getByLabel('University name').fill('Phase Seven University')
  await page.getByLabel('University slug').fill('phase-seven-university')
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText('Phase Seven University')).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await page.getByLabel('Organization name').fill('Phase Seven Chapter')
  await page.getByLabel('Organization slug').fill('phase-seven-chapter')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText('Phase Seven Chapter')).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'fall 2026' })).toBeVisible()

  await page.getByLabel('Join code').fill('P7FLOW26')
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText('Code: P7FLOW26')).toBeVisible()

  await submitInterestAsStudent(page, 'phase7-student-yes', 'P7FLOW26')
  await submitInterestAsStudent(page, 'phase7-student-no', 'P7FLOW26')

  await writeSession(page, {
    isAuthenticated: true,
    userId: 'phase7-super-admin',
    phoneE164: '+14155550123',
    displayName: 'Phase 7 Super Admin',
    needsOnboarding: false,
    roles: ['super_admin', 'chapter_admin'],
  })

  await navigateInApp(page, '/super/cycles')
  await page.getByRole('link', { name: /open stage 1/i }).first().click()
  await expect(page.getByRole('heading', { name: /stage 1 queue/i })).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase7-student-yes' })
    .getByRole('button', { name: /shortlist/i })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase7-student-no' })
    .getByRole('button', { name: /shortlist/i })
    .click()

  await page.getByRole('link', { name: /^stage 2$/i }).click()
  await expect(page.getByRole('heading', { name: /stage 2 decisions/i })).toBeVisible()

  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase7-student-yes' })
    .getByRole('button', { name: /^final yes$/i })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'phase7-student-no' })
    .getByRole('button', { name: /^final no$/i })
    .click()

  await page.getByRole('link', { name: /^messages$/i }).click()
  await expect(page.getByRole('heading', { name: /^messages$/i })).toBeVisible()

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
