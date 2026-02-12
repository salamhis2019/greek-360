import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetAuthServiceForTests } from '@/features/auth/authService'
import { resetSuperAdminServiceForTests } from '@/features/super-admin/superAdminService'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  resetAuthServiceForTests()
  resetSuperAdminServiceForTests()
})
