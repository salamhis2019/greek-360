import { describe, expect, it } from 'vitest'
import { authService } from '@/features/auth/authService'
import { directoryService } from '@/features/directory/directoryService'
import { interestService } from '@/features/interest/interestService'
import { offerService } from '@/features/offers/offerService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-phase6-security',
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
    throw new Error('Expected pending offer.')
  }

  await offerService.respondToOffer({
    actorUserId: userId,
    offerId: pendingOffer.id,
    response: 'accept',
  })
}

describe('Directory privacy security', () => {
  it('denies unauthenticated directory access', async () => {
    await expect(directoryService.searchPeople({ actorUserId: null })).rejects.toMatchObject({
      code: 'unauthenticated',
    })
  })

  it('does not leak phone or email to same-campus users without shared organization membership', async () => {
    const university = await superAdminService.createUniversity(superAdminActor, {
      name: 'Security University',
      slug: 'security-university',
      status: 'active',
    })

    const redOrg = await superAdminService.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Red Org',
      slug: 'red-org',
      type: 'fraternity',
      status: 'active',
    })

    const blueOrg = await superAdminService.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Blue Org',
      slug: 'blue-org',
      type: 'sorority',
      status: 'active',
    })

    const redCycle = await superAdminService.createRecruitmentCycle(superAdminActor, {
      organizationId: redOrg.id,
      term: 'fall',
      year: 2026,
      status: 'active',
    })

    const blueCycle = await superAdminService.createRecruitmentCycle(superAdminActor, {
      organizationId: blueOrg.id,
      term: 'fall',
      year: 2026,
      status: 'active',
    })

    await superAdminService.createJoinLink(superAdminActor, {
      organizationId: redOrg.id,
      cycleId: redCycle.id,
      code: 'P6RED001',
    })
    await superAdminService.createJoinLink(superAdminActor, {
      organizationId: blueOrg.id,
      cycleId: blueCycle.id,
      code: 'P6BLUE01',
    })

    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: redOrg.id,
      userId: 'security-red-admin',
    })
    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: blueOrg.id,
      userId: 'security-blue-admin',
    })

    const redActor = await createUserProfile({
      phoneE164: '+14155552001',
      name: 'Red Actor',
      email: 'red.actor@example.edu',
    })

    const blueMember = await createUserProfile({
      phoneE164: '+14155552002',
      name: 'Blue Member',
      email: 'blue.member@example.edu',
    })

    await makeActiveMember({
      userId: redActor.userId,
      joinCode: 'P6RED001',
      adminUserId: 'security-red-admin',
    })
    await makeActiveMember({
      userId: blueMember.userId,
      joinCode: 'P6BLUE01',
      adminUserId: 'security-blue-admin',
    })

    const records = await directoryService.searchPeople({
      actorUserId: redActor.userId,
    })

    const blueRecord = records.find((record) => record.userId === blueMember.userId)
    expect(blueRecord).toBeDefined()
    expect(blueRecord?.phoneE164).toBeNull()
    expect(blueRecord?.email).toBeNull()
  })
})
