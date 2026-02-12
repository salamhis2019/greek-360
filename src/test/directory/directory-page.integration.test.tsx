import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { authService } from '@/features/auth/authService'
import { interestService } from '@/features/interest/interestService'
import { offerService } from '@/features/offers/offerService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-phase6-directory-ui',
  actorRoles: ['super_admin'],
}

const createUserProfile = async ({
  phoneE164,
  name,
  email,
}: {
  phoneE164: string
  name: string
  email?: string | null
}) => {
  await authService.startPhoneAuth(phoneE164)
  const verification = await authService.verifyPhoneAuth({
    phoneNumber: phoneE164,
    otpCode: '123456',
  })

  return authService.upsertProfile({
    userId: verification.profile.userId,
    name,
    email: email ?? null,
  })
}

const makeActiveMember = async ({
  userId,
  joinCode,
  adminUserId,
}: {
  userId: string
  joinCode: string
  adminUserId: string
}) => {
  const interest = await interestService.submitInterest({
    actorUserId: userId,
    joinCode,
    source: 'manual_code',
  })

  await recruitmentService.submitStage1Decision(
    { actorUserId: adminUserId, actorRoles: ['chapter_admin'] },
    { interestEntryId: interest.entry.id, decision: 'yes' }
  )
  await recruitmentService.submitStage2Decision(
    { actorUserId: adminUserId, actorRoles: ['chapter_admin'] },
    { interestEntryId: interest.entry.id, decision: 'yes' }
  )

  const offers = await offerService.listOffersForStudent(userId)
  const pendingOffer = offers.find((offer) => offer.status === 'pending')
  if (!pendingOffer) {
    throw new Error('Expected pending offer for directory UI test.')
  }

  await offerService.respondToOffer({
    actorUserId: userId,
    offerId: pendingOffer.id,
    response: 'accept',
  })
}

const seedDirectoryData = async () => {
  const university = await superAdminService.createUniversity(superAdminActor, {
    name: 'Directory UI University',
    slug: 'directory-ui-university',
    status: 'active',
  })

  const alphaOrg = await superAdminService.createOrganization(superAdminActor, {
    universityId: university.id,
    name: 'UI Alpha Org',
    slug: 'ui-alpha-org',
    type: 'fraternity',
    status: 'active',
  })

  const betaOrg = await superAdminService.createOrganization(superAdminActor, {
    universityId: university.id,
    name: 'UI Beta Org',
    slug: 'ui-beta-org',
    type: 'sorority',
    status: 'active',
  })

  const alphaCycle = await superAdminService.createRecruitmentCycle(superAdminActor, {
    organizationId: alphaOrg.id,
    term: 'fall',
    year: 2026,
    status: 'active',
  })

  const betaCycle = await superAdminService.createRecruitmentCycle(superAdminActor, {
    organizationId: betaOrg.id,
    term: 'fall',
    year: 2026,
    status: 'active',
  })

  await superAdminService.createJoinLink(superAdminActor, {
    organizationId: alphaOrg.id,
    cycleId: alphaCycle.id,
    code: 'P6UIALPH',
  })

  await superAdminService.createJoinLink(superAdminActor, {
    organizationId: betaOrg.id,
    cycleId: betaCycle.id,
    code: 'P6UIBETA',
  })

  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: alphaOrg.id,
    userId: 'phase6-ui-admin-alpha',
  })

  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: betaOrg.id,
    userId: 'phase6-ui-admin-beta',
  })

  const actor = await createUserProfile({
    phoneE164: '+14155553001',
    name: 'UI Actor',
    email: 'ui.actor@example.edu',
  })
  const sameOrg = await createUserProfile({
    phoneE164: '+14155553002',
    name: 'UI Same Org',
    email: 'ui.sameorg@example.edu',
  })
  const differentOrg = await createUserProfile({
    phoneE164: '+14155553003',
    name: 'UI Different Org',
    email: 'ui.difforg@example.edu',
  })

  await makeActiveMember({
    userId: actor.userId,
    joinCode: 'P6UIALPH',
    adminUserId: 'phase6-ui-admin-alpha',
  })
  await makeActiveMember({
    userId: sameOrg.userId,
    joinCode: 'P6UIALPH',
    adminUserId: 'phase6-ui-admin-alpha',
  })
  await makeActiveMember({
    userId: differentOrg.userId,
    joinCode: 'P6UIBETA',
    adminUserId: 'phase6-ui-admin-beta',
  })

  return {
    actor,
    sameOrg,
    differentOrg,
  }
}

describe('Directory page integration', () => {
  it('shows private fields only for same-organization members', async () => {
    const seeded = await seedDirectoryData()

    renderAppAtRoute('/directory', {
      isAuthenticated: true,
      userId: seeded.actor.userId,
      roles: ['student'],
      displayName: seeded.actor.name,
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /^directory$/i })).toBeInTheDocument()
    )

    await waitFor(() => expect(screen.getByText(/ui same org/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/phone: \+14155553002/i)).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByText(/email: ui\.sameorg@example\.edu/i)).toBeInTheDocument()
    )

    await waitFor(() => expect(screen.getByText(/ui different org/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/phone: hidden/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/email: hidden/i)).toBeInTheDocument())
  })

  it('supports searching directory records by name and organization', async () => {
    const seeded = await seedDirectoryData()

    renderAppAtRoute('/directory', {
      isAuthenticated: true,
      userId: seeded.actor.userId,
      roles: ['student'],
      displayName: seeded.actor.name,
    })

    await waitFor(() => expect(screen.getByText(/ui same org/i)).toBeInTheDocument())
    const searchInput = screen.getByLabelText(/search by name or organization/i)

    fireEvent.change(searchInput, { target: { value: 'different org' } })
    await waitFor(() => expect(screen.getByText(/ui different org/i)).toBeInTheDocument())
    expect(screen.queryByText(/ui same org/i)).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'ui alpha org' } })
    await waitFor(() => expect(screen.getByText(/ui same org/i)).toBeInTheDocument())
    expect(screen.queryByText(/ui different org/i)).not.toBeInTheDocument()
  })
})
