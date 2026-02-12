import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetAuthServiceForTests } from '@/features/auth/authService'
import { resetInterestServiceForTests } from '@/features/interest/interestService'
import { resetSuperAdminServiceForTests } from '@/features/super-admin/superAdminService'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  resetAuthServiceForTests()
  resetInterestServiceForTests()
  resetSuperAdminServiceForTests()
})
