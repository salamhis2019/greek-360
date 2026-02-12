import { expect, test } from '@playwright/test'

test('super-admin can configure university, organization, cycle, join code, and admin assignment', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const session = {
      isAuthenticated: true,
      userId: 'super-admin-user',
      phoneE164: '+14155550123',
      displayName: 'Super Admin',
      needsOnboarding: false,
      roles: ['super_admin'],
    }

    window.sessionStorage.setItem('greek360.auth.session', JSON.stringify(session))
  })

  await page.goto('/super/universities')

  await page.getByLabel('University name').fill('University of Pacific')
  await page.getByLabel('University slug').fill('university-of-pacific')
  await page.getByRole('button', { name: 'Create university' }).click()
  await expect(page.getByText('University of Pacific')).toBeVisible()

  await page.getByRole('link', { name: 'Organizations' }).click()
  await expect(page.getByRole('heading', { name: /^Organizations$/ })).toBeVisible()
  await page.getByLabel('Organization name').fill('Gamma Eta')
  await page.getByLabel('Organization slug').fill('gamma-eta')
  await page.getByLabel('Organization type').selectOption('fraternity')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByText('Gamma Eta')).toBeVisible()

  await page.getByRole('link', { name: 'Recruitment cycles' }).click()
  await expect(page.getByRole('heading', { name: /^Recruitment cycles$/ })).toBeVisible()
  await page.getByLabel('Term').fill('fall')
  await page.getByLabel('Year').fill('2026')
  await page.getByRole('button', { name: 'Create cycle' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'fall 2026' })).toBeVisible()

  await page.getByRole('button', { name: 'Generate code' }).click()
  await page.getByRole('button', { name: 'Create join link' }).click()
  await expect(page.getByText(/Code:/)).toBeVisible()

  await page.getByRole('link', { name: 'Admin assignments' }).click()
  await expect(page.getByRole('heading', { name: /^Admin assignments$/ })).toBeVisible()
  await page.getByLabel('Admin user id').fill('org-admin-user-1')
  await page.getByRole('button', { name: 'Assign admin' }).click()
  await expect(page.getByText('org-admin-user-1')).toBeVisible()
})
