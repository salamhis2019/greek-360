import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { TEST_IDS } from '@/app/testing/testIds'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'
import { resetInterestServiceForTests, interestService } from '@/features/interest/interestService'
import { resetOfferServiceForTests } from '@/features/offers/offerService'
import {
  resetSuperAdminServiceForTests,
  superAdminService,
  type SuperAdminActor,
} from '@/features/super-admin/superAdminService'
import { resetRecruitmentServiceForTests } from '@/features/recruitment/recruitmentService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'admin-dashboard-super-admin',
  actorRoles: ['super_admin'],
}

describe('Chapter recruiting dashboard', () => {
  it('lists manageable cycles with queue counts and quick links', async () => {
    resetInterestServiceForTests()
    resetOfferServiceForTests()
    resetSuperAdminServiceForTests()
    resetRecruitmentServiceForTests()

    const university = await superAdminService.createUniversity(superAdminActor, {
      name: 'Admin Dashboard University',
      slug: 'admin-dashboard-university',
      status: 'active',
    })

    const organization = await superAdminService.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Admin Dashboard Chapter',
      slug: 'admin-dashboard-chapter',
      type: 'fraternity',
      status: 'active',
    })

    const cycle = await superAdminService.createRecruitmentCycle(superAdminActor, {
      organizationId: organization.id,
      term: 'fall',
      year: 2026,
      status: 'active',
    })

    await superAdminService.createJoinLink(superAdminActor, {
      organizationId: organization.id,
      cycleId: cycle.id,
      code: 'ADMN2601',
    })

    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: organization.id,
      userId: 'chapter-admin-user-dashboard',
    })

    await interestService.submitInterest({
      actorUserId: 'dashboard-student-1',
      joinCode: 'ADMN2601',
      source: 'qr',
    })

    renderAppAtRoute('/admin', {
      isAuthenticated: true,
      userId: 'chapter-admin-user-dashboard',
      roles: ['chapter_admin'],
      needsOnboarding: false,
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /chapter recruiting/i })).toBeInTheDocument()
    )

    await waitFor(() =>
      expect(screen.getByText(/admin dashboard chapter/i)).toBeInTheDocument()
    )

    expect(screen.getByText(/stage 1: 1/i)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.admin.cycleStage1Link(cycle.id))).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.admin.cycleMembersLink(cycle.id))).toBeInTheDocument()
  })
})
