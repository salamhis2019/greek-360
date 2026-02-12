import { describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import { offerService } from '@/features/offers/offerService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-security-phase5',
  actorRoles: ['super_admin'],
}

const createOfferForStudent = async ({
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

  const offers = await offerService.listOffersForStudent(studentUserId)
  const offer = offers[0]
  if (!offer) {
    throw new Error('Expected offer to exist for security test setup.')
  }

  return offer
}

describe('Offer response authorization', () => {
  it('denies offer response attempts from a different student', async () => {
    const offer = await createOfferForStudent({
      code: 'SECORG5A',
      adminUserId: 'chapter-admin-sec-5a',
      studentUserId: 'student-security-5a',
    })

    await expect(
      offerService.respondToOffer({
        actorUserId: 'student-security-5b',
        offerId: offer.id,
        response: 'accept',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('denies unauthenticated offer response attempts', async () => {
    const offer = await createOfferForStudent({
      code: 'SECORG5B',
      adminUserId: 'chapter-admin-sec-5b',
      studentUserId: 'student-security-5c',
    })

    await expect(
      offerService.respondToOffer({
        actorUserId: null,
        offerId: offer.id,
        response: 'decline',
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})
