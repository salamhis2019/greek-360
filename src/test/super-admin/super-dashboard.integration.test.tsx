import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'
import {
  resetSuperAdminServiceForTests,
  superAdminService,
  type SuperAdminActor,
} from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-dashboard-admin',
  actorRoles: ['super_admin'],
}

describe('Campus setup dashboard', () => {
  it('shows setup checklist counts', async () => {
    resetSuperAdminServiceForTests()

    const university = await superAdminService.createUniversity(superAdminActor, {
      name: 'Super Dashboard University',
      slug: 'super-dashboard-university',
      status: 'active',
    })

    const organization = await superAdminService.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Super Dashboard Org',
      slug: 'super-dashboard-org',
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
      code: 'SUPR2601',
    })

    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: organization.id,
      userId: 'super-dashboard-assigned-admin',
    })

    renderAppAtRoute('/super', {
      isAuthenticated: true,
      userId: 'super-dashboard-admin',
      roles: ['super_admin'],
      needsOnboarding: false,
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /campus setup/i })).toBeInTheDocument()
    )

    await waitFor(() => expect(screen.getByText(/1 cycles · 1 join links/i)).toBeInTheDocument())

    expect(screen.getAllByText(/1 configured/i)).toHaveLength(2)
    expect(screen.getByText(/1 current admin assignments/i)).toBeInTheDocument()
  })
})
