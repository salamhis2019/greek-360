import { expect, test } from '@playwright/test'
import { TEST_IDS } from '../../src/app/testing/testIds'

test('super-admin can configure university, organization, cycle, join code, and admin assignment', async ({
  page,
}) => {
  const projectTag = test.info().project.name.includes('mobile') ? 'm' : 'd'
  const universityName = `University of Pacific ${projectTag.toUpperCase()}`
  const universitySlug = `university-of-pacific-${projectTag}`
  const organizationName = `Gamma Eta ${projectTag.toUpperCase()}`
  const organizationSlug = `gamma-eta-${projectTag}`
  const adminUserId = `org-admin-user-1-${projectTag}`

  await page.addInitScript(() => {
    const session = {
      isAuthenticated: true,
      userId: 'super-admin-user',
      phoneE164: '+14155550123',
      displayName: 'Super Admin',
      needsOnboarding: false,
      roles: ['super_admin'],
    }

    window.sessionStorage.setItem('greek360.dev.useInMemory', 'true')
    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(session))
  })

  await page.goto('/super/universities')

  await expect(page.getByTestId(TEST_IDS.superAdmin.universitiesHeading)).toBeVisible()
  await page.getByLabel('University name').fill(universityName)
  await page.getByLabel('University slug').fill(universitySlug)
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText(universityName)).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await expect(page.getByTestId(TEST_IDS.superAdmin.organizationsHeading)).toBeVisible()
  await page.getByLabel('Organization name').fill(organizationName)
  await page.getByLabel('Organization slug').fill(organizationSlug)
  await page.getByLabel('Organization type').selectOption('fraternity')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText(organizationName)).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await expect(page.getByTestId(TEST_IDS.superAdmin.cyclesHeading)).toBeVisible()
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'fall 2026' })).toBeVisible()

  await page.getByRole('button', { name: 'Generate code' }).click()
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText(/Code:/)).toBeVisible()

  await page.getByRole('link', { name: 'Admin assignments' }).click()
  await expect(page.getByTestId(TEST_IDS.superAdmin.adminsHeading)).toBeVisible()
  await page.getByLabel('Admin user id').fill(adminUserId)
  await page.getByRole('button', { name: 'Assign admin' }).click()
  await expect(page.getByText(adminUserId)).toBeVisible()
})
