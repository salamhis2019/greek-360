import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'
import { resetInterestServiceForTests, interestService } from '@/features/interest/interestService'
import { resetOfferServiceForTests, offerService } from '@/features/offers/offerService'
import {
  resetSuperAdminServiceForTests,
  superAdminService,
  type SuperAdminActor,
} from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'student-home-super-admin',
  actorRoles: ['super_admin'],
}

describe('Student rush home', () => {
  it('shows a guided empty state when the student has no interests', async () => {
    resetInterestServiceForTests()
    resetOfferServiceForTests()
    resetSuperAdminServiceForTests()

    renderAppAtRoute('/home', {
      isAuthenticated: true,
      userId: 'student-home-empty',
      roles: ['student'],
      needsOnboarding: false,
    })

    await waitFor(() =>
      expect(screen.getByText(/no interests submitted yet/i)).toBeInTheDocument()
    )

    expect(screen.getByRole('link', { name: /enter join code/i })).toHaveAttribute('href', '/code')
  })

  it('renders human-readable interest rows with offer status labels', async () => {
    resetInterestServiceForTests()
    resetOfferServiceForTests()
    resetSuperAdminServiceForTests()

    const university = await superAdminService.createUniversity(superAdminActor, {
      name: 'Student Home University',
      slug: 'student-home-university',
      status: 'active',
    })

    const organization = await superAdminService.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Student Home Chapter',
      slug: 'student-home-chapter',
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
      code: 'STHOME26',
      isActive: true,
    })

    const submittedInterest = await interestService.submitInterest({
      actorUserId: 'student-home-user-1',
      joinCode: 'STHOME26',
      source: 'manual_code',
    })

    await offerService.ensurePendingOfferForFinalYes({
      interestEntryId: submittedInterest.entry.id,
      userId: 'student-home-user-1',
      organizationId: organization.id,
      cycleId: cycle.id,
    })

    renderAppAtRoute('/home', {
      isAuthenticated: true,
      userId: 'student-home-user-1',
      roles: ['student'],
      needsOnboarding: false,
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my rush/i })).toBeInTheDocument()
    )
    await waitFor(() =>
      expect(screen.getByText(/student home chapter/i)).toBeInTheDocument()
    )

    expect(screen.getByText(/offer pending/i)).toBeInTheDocument()
    expect(screen.getByText(/fall 2026/i)).toBeInTheDocument()
  })
})
