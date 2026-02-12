import { describe, expect, it } from 'vitest'
import { authService } from '@/features/auth/authService'
import { directoryService } from '@/features/directory/directoryService'
import { interestService } from '@/features/interest/interestService'
import { offerService } from '@/features/offers/offerService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-phase6-directory',
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

  const profile = await authService.upsertProfile({
    userId: verification.profile.userId,
    name,
    email: email ?? null,
  })

  return profile
}

const createActiveMembership = async ({
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

  const offers = await offerService.listOffersForStudent(userId)
  const pendingOffer = offers.find((offer) => offer.status === 'pending')

  if (!pendingOffer) {
    throw new Error('Expected pending offer for membership activation.')
  }

  await offerService.respondToOffer({
    actorUserId: userId,
    offerId: pendingOffer.id,
    response: 'accept',
  })
}

const seedDirectoryScenario = async () => {
  const universityAlpha = await superAdminService.createUniversity(superAdminActor, {
    name: 'Directory University Alpha',
    slug: 'directory-university-alpha',
    status: 'active',
  })

  const universityBeta = await superAdminService.createUniversity(superAdminActor, {
    name: 'Directory University Beta',
    slug: 'directory-university-beta',
    status: 'active',
  })

  const alphaOrgOne = await superAdminService.createOrganization(superAdminActor, {
    universityId: universityAlpha.id,
    name: 'Alpha Chapter One',
    slug: 'alpha-chapter-one',
    type: 'fraternity',
    status: 'active',
  })

  const alphaOrgTwo = await superAdminService.createOrganization(superAdminActor, {
    universityId: universityAlpha.id,
    name: 'Alpha Chapter Two',
    slug: 'alpha-chapter-two',
    type: 'sorority',
    status: 'active',
  })

  const betaOrgOne = await superAdminService.createOrganization(superAdminActor, {
    universityId: universityBeta.id,
    name: 'Beta Chapter One',
    slug: 'beta-chapter-one',
    type: 'fraternity',
    status: 'active',
  })

  const alphaCycleOne = await superAdminService.createRecruitmentCycle(superAdminActor, {
    organizationId: alphaOrgOne.id,
    term: 'fall',
    year: 2026,
    status: 'active',
  })

  const alphaCycleTwo = await superAdminService.createRecruitmentCycle(superAdminActor, {
    organizationId: alphaOrgTwo.id,
    term: 'fall',
    year: 2026,
    status: 'active',
  })

  const betaCycleOne = await superAdminService.createRecruitmentCycle(superAdminActor, {
    organizationId: betaOrgOne.id,
    term: 'fall',
    year: 2026,
    status: 'active',
  })

  await superAdminService.createJoinLink(superAdminActor, {
    organizationId: alphaOrgOne.id,
    cycleId: alphaCycleOne.id,
    code: 'P6ALPHA1',
  })

  await superAdminService.createJoinLink(superAdminActor, {
    organizationId: alphaOrgTwo.id,
    cycleId: alphaCycleTwo.id,
    code: 'P6ALPHA2',
  })

  await superAdminService.createJoinLink(superAdminActor, {
    organizationId: betaOrgOne.id,
    cycleId: betaCycleOne.id,
    code: 'P6BETA01',
  })

  const alphaOrgAdmin = 'directory-alpha-admin'
  const betaOrgAdmin = 'directory-beta-admin'

  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: alphaOrgOne.id,
    userId: alphaOrgAdmin,
  })
  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: alphaOrgTwo.id,
    userId: alphaOrgAdmin,
  })
  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: betaOrgOne.id,
    userId: betaOrgAdmin,
  })

  const actor = await createUserProfile({
    phoneE164: '+14155551001',
    name: 'Actor Member',
    email: 'actor.member@example.edu',
  })
  const sameOrg = await createUserProfile({
    phoneE164: '+14155551002',
    name: 'Same Org Member',
    email: 'same.org@example.edu',
  })
  const sameUniversityDifferentOrg = await createUserProfile({
    phoneE164: '+14155551003',
    name: 'Different Org Member',
    email: 'different.org@example.edu',
  })
  const sameUniversityProspect = await createUserProfile({
    phoneE164: '+14155551004',
    name: 'Campus Prospect',
    email: 'campus.prospect@example.edu',
  })
  const differentUniversity = await createUserProfile({
    phoneE164: '+14155551005',
    name: 'Other Campus Member',
    email: 'other.campus@example.edu',
  })

  await createActiveMembership({
    userId: actor.userId,
    joinCode: 'P6ALPHA1',
    adminUserId: alphaOrgAdmin,
  })
  await createActiveMembership({
    userId: sameOrg.userId,
    joinCode: 'P6ALPHA1',
    adminUserId: alphaOrgAdmin,
  })
  await createActiveMembership({
    userId: sameUniversityDifferentOrg.userId,
    joinCode: 'P6ALPHA2',
    adminUserId: alphaOrgAdmin,
  })
  await createActiveMembership({
    userId: differentUniversity.userId,
    joinCode: 'P6BETA01',
    adminUserId: betaOrgAdmin,
  })

  await interestService.submitInterest({
    actorUserId: sameUniversityProspect.userId,
    joinCode: 'P6ALPHA2',
    source: 'manual_code',
  })

  return {
    actor,
    sameOrg,
    sameUniversityDifferentOrg,
    sameUniversityProspect,
    differentUniversity,
    alphaOrgOne,
    alphaOrgTwo,
  }
}

describe('Directory service privacy and search', () => {
  it('requires authentication for directory queries', async () => {
    await expect(
      directoryService.searchPeople({
        actorUserId: null,
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('returns same-university basic fields while redacting private fields outside shared membership', async () => {
    const scenario = await seedDirectoryScenario()

    const records = await directoryService.searchPeople({
      actorUserId: scenario.actor.userId,
    })

    const actorRecord = records.find((record) => record.userId === scenario.actor.userId)
    const sameOrgRecord = records.find((record) => record.userId === scenario.sameOrg.userId)
    const differentOrgRecord = records.find(
      (record) => record.userId === scenario.sameUniversityDifferentOrg.userId
    )
    const prospectRecord = records.find(
      (record) => record.userId === scenario.sameUniversityProspect.userId
    )
    const otherCampusRecord = records.find(
      (record) => record.userId === scenario.differentUniversity.userId
    )

    expect(actorRecord).toBeDefined()
    expect(actorRecord?.phoneE164).toBe('+14155551001')
    expect(actorRecord?.email).toBe('actor.member@example.edu')

    expect(sameOrgRecord).toBeDefined()
    expect(sameOrgRecord?.phoneE164).toBe('+14155551002')
    expect(sameOrgRecord?.email).toBe('same.org@example.edu')

    expect(differentOrgRecord).toBeDefined()
    expect(differentOrgRecord?.phoneE164).toBeNull()
    expect(differentOrgRecord?.email).toBeNull()

    expect(prospectRecord).toBeDefined()
    expect(prospectRecord?.phoneE164).toBeNull()
    expect(prospectRecord?.email).toBeNull()

    expect(otherCampusRecord).toBeUndefined()
  })

  it('supports searching by person name and organization name', async () => {
    const scenario = await seedDirectoryScenario()

    const byPerson = await directoryService.searchPeople({
      actorUserId: scenario.actor.userId,
      search: 'same org',
    })

    expect(byPerson.map((record) => record.userId)).toContain(scenario.sameOrg.userId)
    expect(byPerson.map((record) => record.userId)).not.toContain(
      scenario.sameUniversityDifferentOrg.userId
    )

    const byOrganization = await directoryService.searchPeople({
      actorUserId: scenario.actor.userId,
      search: 'alpha chapter two',
    })

    expect(byOrganization.map((record) => record.userId)).toContain(
      scenario.sameUniversityDifferentOrg.userId
    )

    const filteredByOrganization = await directoryService.searchPeople({
      actorUserId: scenario.actor.userId,
      organizationId: scenario.alphaOrgOne.id,
    })

    expect(filteredByOrganization.map((record) => record.userId)).toContain(scenario.sameOrg.userId)
    expect(filteredByOrganization.map((record) => record.userId)).not.toContain(
      scenario.sameUniversityDifferentOrg.userId
    )
  })
})
