import { beforeEach, describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import { offerService } from '@/features/offers/offerService'
import { recruitmentService, type RecruitmentActor } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-phase5',
  actorRoles: ['super_admin'],
}

const createRecruitmentCycle = async (code: string) => {
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

  return { organization, cycle }
}

const createAdminActor = (userId: string): RecruitmentActor => ({
  actorUserId: userId,
  actorRoles: ['chapter_admin'],
})

const createFinalYesOffer = async ({
  code,
  adminUserId,
  studentUserId,
}: {
  code: string
  adminUserId: string
  studentUserId: string
}) => {
  const seeded = await createRecruitmentCycle(code)

  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: seeded.organization.id,
    userId: adminUserId,
  })

  const interest = await interestService.submitInterest({
    actorUserId: studentUserId,
    joinCode: code,
    source: 'qr',
  })

  const actor = createAdminActor(adminUserId)
  await recruitmentService.submitStage1Decision(actor, {
    interestEntryId: interest.entry.id,
    decision: 'yes',
  })
  await recruitmentService.submitStage2Decision(actor, {
    interestEntryId: interest.entry.id,
    decision: 'yes',
  })

  const offers = await offerService.listOffersForStudent(studentUserId)
  const offer = offers.find((item) => item.interestEntryId === interest.entry.id)

  if (!offer) {
    throw new Error('Expected offer to be created for final yes decision.')
  }

  return { seeded, interest, offer }
}

describe('Offer and membership integration', () => {
  beforeEach(async () => {
    await offerService.listOffersForStudent('bootstrap-user-phase5')
  })

  it('creates a pending offer on final yes and lets the student decline it', async () => {
    const created = await createFinalYesOffer({
      code: 'OFFERP5A',
      adminUserId: 'offer-admin-1',
      studentUserId: 'offer-student-1',
    })

    expect(created.offer.status).toBe('pending')

    const response = await offerService.respondToOffer({
      actorUserId: 'offer-student-1',
      offerId: created.offer.id,
      response: 'decline',
    })

    expect(response.offer.status).toBe('declined')
    expect(response.offer.respondedAt).not.toBeNull()
    expect(response.membership).toBeNull()

    const memberships = await offerService.listMembershipsForUser('offer-student-1')
    expect(memberships).toHaveLength(0)
  })

  it('creates exactly one active membership on accept and treats repeated accept as idempotent', async () => {
    const created = await createFinalYesOffer({
      code: 'OFFERP5B',
      adminUserId: 'offer-admin-2',
      studentUserId: 'offer-student-2',
    })

    const first = await offerService.respondToOffer({
      actorUserId: 'offer-student-2',
      offerId: created.offer.id,
      response: 'accept',
    })

    const second = await offerService.respondToOffer({
      actorUserId: 'offer-student-2',
      offerId: created.offer.id,
      response: 'accept',
    })

    expect(first.offer.status).toBe('accepted')
    expect(first.membership?.status).toBe('active')
    expect(second.offer.id).toBe(first.offer.id)
    expect(second.membership?.id).toBe(first.membership?.id)

    const memberships = await offerService.listMembershipsForUser('offer-student-2')
    expect(memberships).toHaveLength(1)
    expect(memberships[0]?.status).toBe('active')
  })

  it('handles concurrent accepts across two offers with one active membership and one rejected response', async () => {
    const first = await createFinalYesOffer({
      code: 'OFFERP5C1',
      adminUserId: 'offer-admin-3',
      studentUserId: 'offer-student-3',
    })

    const second = await createFinalYesOffer({
      code: 'OFFERP5C2',
      adminUserId: 'offer-admin-4',
      studentUserId: 'offer-student-3',
    })

    const results = await Promise.allSettled([
      offerService.respondToOffer({
        actorUserId: 'offer-student-3',
        offerId: first.offer.id,
        response: 'accept',
      }),
      offerService.respondToOffer({
        actorUserId: 'offer-student-3',
        offerId: second.offer.id,
        response: 'accept',
      }),
    ])

    const fulfilledCount = results.filter((result) => result.status === 'fulfilled').length
    const rejected = results.find((result) => result.status === 'rejected')

    expect(fulfilledCount).toBe(1)
    expect(rejected).toBeDefined()
    if (rejected && rejected.status === 'rejected') {
      expect(rejected.reason).toMatchObject({
        code: expect.stringMatching(/membership_conflict|invalid_transition/),
      })
    }

    const offers = await offerService.listOffersForStudent('offer-student-3')
    const acceptedOffers = offers.filter((offer) => offer.status === 'accepted')
    expect(acceptedOffers).toHaveLength(1)
    expect(offers.some((offer) => offer.status === 'expired')).toBe(true)

    const memberships = await offerService.listMembershipsForUser('offer-student-3')
    expect(memberships.filter((membership) => membership.status === 'active')).toHaveLength(1)
  })
})
