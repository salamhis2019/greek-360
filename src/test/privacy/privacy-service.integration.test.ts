import { describe, expect, it } from 'vitest'
import { authService } from '@/features/auth/authService'
import { interestService } from '@/features/interest/interestService'
import { messagingService } from '@/features/messaging/messagingService'
import { offerService } from '@/features/offers/offerService'
import {
  isUserDeleted,
  privacyService,
  PrivacyServiceError,
} from '@/features/privacy/privacyService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'phase8-super-admin',
  actorRoles: ['super_admin'],
}

const bootstrapStudent = async (phoneNumber: string, name: string, email: string) => {
  await authService.startPhoneAuth(phoneNumber)
  const verified = await authService.verifyPhoneAuth({
    phoneNumber,
    otpCode: '123456',
  })

  await authService.upsertProfile({
    userId: verified.profile.userId,
    name,
    email,
  })

  return verified.profile.userId
}

const seedRecruitmentFlow = async ({
  joinCode,
  chapterAdminUserId,
  studentUserId,
}: {
  joinCode: string
  chapterAdminUserId: string
  studentUserId: string
}) => {
  const university = await superAdminService.createUniversity(superAdminActor, {
    name: `University ${joinCode}`,
    slug: `university-${joinCode.toLowerCase()}`,
    status: 'active',
  })

  const organization = await superAdminService.createOrganization(superAdminActor, {
    universityId: university.id,
    name: `Organization ${joinCode}`,
    slug: `organization-${joinCode.toLowerCase()}`,
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
    code: joinCode,
  })

  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: organization.id,
    userId: chapterAdminUserId,
  })

  const interest = await interestService.submitInterest({
    actorUserId: studentUserId,
    joinCode,
    source: 'manual_code',
  })

  const chapterAdminActor: { actorUserId: string; actorRoles: Array<'chapter_admin'> } = {
    actorUserId: chapterAdminUserId,
    actorRoles: ['chapter_admin'],
  }

  await recruitmentService.submitStage1Decision(chapterAdminActor, {
    interestEntryId: interest.entry.id,
    decision: 'yes',
  })
  await recruitmentService.submitStage2Decision(chapterAdminActor, {
    interestEntryId: interest.entry.id,
    decision: 'yes',
  })

  await messagingService.sendMessage(chapterAdminActor, {
    organizationId: organization.id,
    cycleId: cycle.id,
    kind: 'acceptance',
    recipientGroup: 'final_yes_pending_offer',
    customSubject: 'Welcome {{ name }}',
    customBodyText: 'You are invited to {{ organization_name }}',
  })

  const offers = await offerService.listOffersForStudent(studentUserId)
  const firstOffer = offers[0]

  if (!firstOffer) {
    throw new Error('Expected pending offer to exist for Phase 8 test setup.')
  }

  await offerService.respondToOffer({
    actorUserId: studentUserId,
    offerId: firstOffer.id,
    response: 'accept',
  })
}

describe('Privacy service integration', () => {
  it('builds a complete export payload with profile, recruitment, membership, and communications metadata', async () => {
    const studentUserId = await bootstrapStudent(
      '+14155553001',
      'Phase8 Export Student',
      'phase8-export@example.test'
    )

    await seedRecruitmentFlow({
      joinCode: 'P8EXPORT',
      chapterAdminUserId: 'phase8-export-admin',
      studentUserId,
    })

    const exportBundle = await privacyService.exportMyData({
      actorUserId: studentUserId,
      actorRoles: ['student'],
    })

    expect(exportBundle.profile.userId).toBe(studentUserId)
    expect(exportBundle.interests).toHaveLength(1)
    expect(exportBundle.decisions.some((decision) => decision.stage === 'shortlist')).toBe(true)
    expect(exportBundle.decisions.some((decision) => decision.stage === 'final')).toBe(true)
    expect(exportBundle.offers).toHaveLength(1)
    expect(exportBundle.memberships).toHaveLength(1)
    expect(exportBundle.communications.length).toBeGreaterThanOrEqual(1)
  })

  it('enforces phone confirmation, supports delete request lifecycle, and marks user deleted on completion', async () => {
    const studentUserId = await bootstrapStudent(
      '+14155553002',
      'Phase8 Deletion Student',
      'phase8-delete@example.test'
    )

    await expect(
      privacyService.requestMyDeletion(
        { actorUserId: studentUserId, actorRoles: ['student'] },
        { phoneNumber: '+14155550000' }
      )
    ).rejects.toMatchObject({
      code: 'invalid_reauth',
    } satisfies Partial<PrivacyServiceError>)

    const request = await privacyService.requestMyDeletion(
      { actorUserId: studentUserId, actorRoles: ['student'] },
      { phoneNumber: '+14155553002' }
    )

    expect(request.status).toBe('requested')

    await expect(
      privacyService.processDeletionRequest(
        { actorUserId: 'phase8-student-attacker', actorRoles: ['student'] },
        { requestId: request.id }
      )
    ).rejects.toMatchObject({
      code: 'forbidden',
    } satisfies Partial<PrivacyServiceError>)

    const processed = await privacyService.processDeletionRequest(
      { actorUserId: 'phase8-system-admin', actorRoles: ['super_admin'] },
      { requestId: request.id }
    )

    expect(processed.status).toBe('completed')
    expect(processed.completedAt).not.toBeNull()
    expect(isUserDeleted(studentUserId)).toBe(true)
  })
})
