import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { resetDirectoryServiceForTests } from '@/features/directory/directoryService'
import { cleanup } from '@testing-library/react'
import { resetAuthServiceForTests } from '@/features/auth/authService'
import { resetInterestServiceForTests } from '@/features/interest/interestService'
import { resetMessagingServiceForTests } from '@/features/messaging/messagingService'
import { resetOfferServiceForTests } from '@/features/offers/offerService'
import { resetPrivacyServiceForTests } from '@/features/privacy/privacyService'
import { resetRecruitmentServiceForTests } from '@/features/recruitment/recruitmentService'
import { resetSuperAdminServiceForTests } from '@/features/super-admin/superAdminService'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  resetAuthServiceForTests()
  resetDirectoryServiceForTests()
  resetInterestServiceForTests()
  resetMessagingServiceForTests()
  resetOfferServiceForTests()
  resetPrivacyServiceForTests()
  resetRecruitmentServiceForTests()
  resetSuperAdminServiceForTests()
})
