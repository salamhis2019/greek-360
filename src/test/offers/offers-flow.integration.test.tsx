import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-ui-phase5',
  actorRoles: ['super_admin'],
}

const seedOffer = async ({
  code,
  adminUserId,
  studentUserId,
}: {
  code: string
  adminUserId: string
  studentUserId: string
}) => {
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

  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: organization.id,
    userId: adminUserId,
  })

  const interest = await interestService.submitInterest({
    actorUserId: studentUserId,
    joinCode: code,
    source: 'manual_code',
  })

  await recruitmentService.submitStage1Decision(
    {
      actorUserId: adminUserId,
      actorRoles: ['chapter_admin'],
    },
    {
      interestEntryId: interest.entry.id,
      decision: 'yes',
    }
  )

  await recruitmentService.submitStage2Decision(
    {
      actorUserId: adminUserId,
      actorRoles: ['chapter_admin'],
    },
    {
      interestEntryId: interest.entry.id,
      decision: 'yes',
    }
  )
}

describe('Offers UI flow integration', () => {
  it('supports accepting an offer and shows active membership state in profile and directory', async () => {
    await seedOffer({
      code: 'OFLOW5A',
      adminUserId: 'chapter-admin-ui-5a',
      studentUserId: 'offer-ui-student-1',
    })

    renderAppAtRoute('/offers', {
      isAuthenticated: true,
      userId: 'offer-ui-student-1',
      roles: ['student'],
      displayName: 'Offer UI Student 1',
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /offers inbox/i })).toBeInTheDocument()
    )
    await waitFor(() => expect(screen.getByText(/status: pending/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() =>
      expect(screen.getByText(/confirm accepting this offer\?/i)).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm accept/i }))

    await waitFor(() => expect(screen.getByText(/status: accepted/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/membership active/i)).toBeInTheDocument())

    cleanup()

    renderAppAtRoute('/profile', {
      isAuthenticated: true,
      userId: 'offer-ui-student-1',
      roles: ['student'],
      displayName: 'Offer UI Student 1',
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument()
    )
    await waitFor(() => expect(screen.getByText(/active membership/i)).toBeInTheDocument())

    cleanup()

    renderAppAtRoute('/directory', {
      isAuthenticated: true,
      userId: 'offer-ui-student-1',
      roles: ['student'],
      displayName: 'Offer UI Student 1',
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /directory/i })).toBeInTheDocument()
    )
    await waitFor(() => expect(screen.getByText(/your membership status/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/active/i)).toBeInTheDocument())
  })

  it('supports declining an offer and keeps membership inactive', async () => {
    await seedOffer({
      code: 'OFLOW5B',
      adminUserId: 'chapter-admin-ui-5b',
      studentUserId: 'offer-ui-student-2',
    })

    renderAppAtRoute('/offers', {
      isAuthenticated: true,
      userId: 'offer-ui-student-2',
      roles: ['student'],
      displayName: 'Offer UI Student 2',
    })

    await waitFor(() => expect(screen.getByText(/status: pending/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /decline/i }))
    await waitFor(() =>
      expect(screen.getByText(/confirm declining this offer\?/i)).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm decline/i }))

    await waitFor(() => expect(screen.getByText(/status: declined/i)).toBeInTheDocument())
    expect(screen.queryByText(/membership active/i)).not.toBeInTheDocument()
  })
})
