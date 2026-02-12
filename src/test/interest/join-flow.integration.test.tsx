import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-join-flow',
  actorRoles: ['super_admin'],
}

const seedJoinLink = async (code: string) => {
  const university = await superAdminService.createUniversity(superAdminActor, {
    name: `University ${code}`,
    slug: `university-${code.toLowerCase()}`,
    status: 'active',
  })

  const organization = await superAdminService.createOrganization(superAdminActor, {
    universityId: university.id,
    name: `Org ${code}`,
    slug: `org-${code.toLowerCase()}`,
    type: 'sorority',
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
    code,
  })
}

describe('Join flow integration', () => {
  it('lets an authenticated student submit interest directly from /join/:code', async () => {
    await seedJoinLink('JOINFLOW')

    renderAppAtRoute('/join/JOINFLOW', {
      isAuthenticated: true,
      userId: 'student-join-flow-1',
      roles: ['student'],
      needsOnboarding: false,
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /join a chapter/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /i'm interested/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /interest submitted/i })).toBeInTheDocument()
    )
    expect(screen.getByText(/we'll notify you in app/i)).toBeInTheDocument()
  })

  it('redirects unauthenticated manual code flow to auth with redirect preserved', async () => {
    await seedJoinLink('MANUAL26')

    renderAppAtRoute('/code')

    fireEvent.change(screen.getByLabelText(/join code/i), {
      target: { value: 'MANUAL26' },
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    )
  })

  it('shows a clear invalid code error on manual entry', async () => {
    renderAppAtRoute('/code', {
      isAuthenticated: true,
      userId: 'student-join-flow-2',
      roles: ['student'],
      needsOnboarding: false,
    })

    fireEvent.change(screen.getByLabelText(/join code/i), {
      target: { value: 'bad!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() =>
      expect(screen.getByText(/join code must be 6-12/i)).toBeInTheDocument()
    )
  })
})
