import { expect, test } from '@playwright/test'
import { TEST_IDS } from '../../src/app/testing/testIds'

test('landing shell renders environment marker', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId(TEST_IDS.app.brandLink)).toBeVisible()
  await expect(page.getByTestId(TEST_IDS.app.environment)).toBeVisible()
})

test('unauthenticated user gets redirected from student home route', async ({ page }) => {
  await page.goto('/home')

  await expect(page.getByTestId(TEST_IDS.auth.stepPhone)).toBeVisible()
})
