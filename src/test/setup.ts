import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetAuthServiceForTests } from '@/features/auth/authService'
import { resetInterestServiceForTests } from '@/features/interest/interestService'
import { resetOfferServiceForTests } from '@/features/offers/offerService'
import { resetRecruitmentServiceForTests } from '@/features/recruitment/recruitmentService'
import { resetSuperAdminServiceForTests } from '@/features/super-admin/superAdminService'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  resetAuthServiceForTests()
  resetInterestServiceForTests()
  resetOfferServiceForTests()
  resetRecruitmentServiceForTests()
  resetSuperAdminServiceForTests()
})
