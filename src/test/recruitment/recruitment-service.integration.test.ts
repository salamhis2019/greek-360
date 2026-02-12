import { beforeEach, describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import { recruitmentService, type RecruitmentActor } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-phase4',
  actorRoles: ['super_admin'],
}

const seedRecruitmentCycle = async (code: string) => {
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

const submitInterest = async ({
  userId,
  code,
}: {
  userId: string
  code: string
}) => {
  return interestService.submitInterest({
    actorUserId: userId,
    joinCode: code,
    source: 'qr',
  })
}

const createAdminActor = (userId: string): RecruitmentActor => ({
  actorUserId: userId,
  actorRoles: ['chapter_admin'],
})

describe('Recruitment decision integration', () => {
  beforeEach(async () => {
    await recruitmentService.listStage1Queue(
      {
        actorUserId: 'bootstrap-super-admin',
        actorRoles: ['super_admin'],
      },
      {
        organizationId: 'bootstrap-org',
        cycleId: 'bootstrap-cycle',
      }
    )
  })

  it('moves a candidate from stage 1 queue to stage 2 queue through shortlist then final decision', async () => {
    const seeded = await seedRecruitmentCycle('PIPE426A')
    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: seeded.organization.id,
      userId: 'chapter-admin-1',
    })

    const interest = await submitInterest({
      userId: 'student-recruitment-1',
      code: 'PIPE426A',
    })

    const actor = createAdminActor('chapter-admin-1')

    const stage1Before = await recruitmentService.listStage1Queue(actor, {
      organizationId: seeded.organization.id,
      cycleId: seeded.cycle.id,
    })
    expect(stage1Before.map((candidate) => candidate.interestEntryId)).toContain(interest.entry.id)

    const stage1Decision = await recruitmentService.submitStage1Decision(actor, {
      interestEntryId: interest.entry.id,
      decision: 'yes',
    })
    expect(stage1Decision.stage).toBe('shortlist')
    expect(stage1Decision.decision).toBe('yes')

    const stage1After = await recruitmentService.listStage1Queue(actor, {
      organizationId: seeded.organization.id,
      cycleId: seeded.cycle.id,
    })
    expect(stage1After.map((candidate) => candidate.interestEntryId)).not.toContain(
      interest.entry.id
    )

    const stage2Before = await recruitmentService.listStage2Queue(actor, {
      organizationId: seeded.organization.id,
      cycleId: seeded.cycle.id,
    })
    expect(stage2Before.map((candidate) => candidate.interestEntryId)).toContain(interest.entry.id)

    const stage2Decision = await recruitmentService.submitStage2Decision(actor, {
      interestEntryId: interest.entry.id,
      decision: 'no',
    })
    expect(stage2Decision.stage).toBe('final')
    expect(stage2Decision.decision).toBe('no')

    const stage2After = await recruitmentService.listStage2Queue(actor, {
      organizationId: seeded.organization.id,
      cycleId: seeded.cycle.id,
    })
    expect(stage2After.map((candidate) => candidate.interestEntryId)).not.toContain(
      interest.entry.id
    )
  })

  it('rejects stage 2 decisions when the candidate was not shortlisted', async () => {
    const seeded = await seedRecruitmentCycle('PIPE426B')
    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: seeded.organization.id,
      userId: 'chapter-admin-2',
    })

    const interest = await submitInterest({
      userId: 'student-recruitment-2',
      code: 'PIPE426B',
    })

    await expect(
      recruitmentService.submitStage2Decision(createAdminActor('chapter-admin-2'), {
        interestEntryId: interest.entry.id,
        decision: 'yes',
      })
    ).rejects.toMatchObject({ code: 'invalid_transition' })
  })

  it('treats repeated identical stage decisions as idempotent and prevents conflicting rewrites', async () => {
    const seeded = await seedRecruitmentCycle('PIPE426C')
    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: seeded.organization.id,
      userId: 'chapter-admin-3',
    })

    const interest = await submitInterest({
      userId: 'student-recruitment-3',
      code: 'PIPE426C',
    })
    const actor = createAdminActor('chapter-admin-3')

    const first = await recruitmentService.submitStage1Decision(actor, {
      interestEntryId: interest.entry.id,
      decision: 'yes',
    })

    const second = await recruitmentService.submitStage1Decision(actor, {
      interestEntryId: interest.entry.id,
      decision: 'yes',
    })

    expect(second.id).toBe(first.id)

    await expect(
      recruitmentService.submitStage1Decision(actor, {
        interestEntryId: interest.entry.id,
        decision: 'no',
      })
    ).rejects.toMatchObject({ code: 'invalid_transition' })
  })

  it('handles concurrent duplicate writes with one persisted stage decision', async () => {
    const seeded = await seedRecruitmentCycle('PIPE426D')
    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: seeded.organization.id,
      userId: 'chapter-admin-4',
    })

    const interest = await submitInterest({
      userId: 'student-recruitment-4',
      code: 'PIPE426D',
    })
    const actor = createAdminActor('chapter-admin-4')

    const [first, second] = await Promise.all([
      recruitmentService.submitStage1Decision(actor, {
        interestEntryId: interest.entry.id,
        decision: 'yes',
      }),
      recruitmentService.submitStage1Decision(actor, {
        interestEntryId: interest.entry.id,
        decision: 'yes',
      }),
    ])

    const decisions = await recruitmentService.listDecisionsForInterestEntry(
      actor,
      interest.entry.id
    )

    expect(first.id).toBe(second.id)
    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.stage).toBe('shortlist')
  })
})
