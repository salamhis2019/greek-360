import { describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import {
  recruitmentService,
  type RecruitmentActor,
} from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-security-phase4',
  actorRoles: ['super_admin'],
}

const seedOrganization = async (code: string) => {
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

  return { organization, cycle }
}

describe('Recruitment decision authorization', () => {
  it('denies cross-organization recruitment list and decision actions', async () => {
    const targetOrg = await seedOrganization('SECORG4A')
    const actorOrg = await seedOrganization('SECORG4B')

    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: actorOrg.organization.id,
      userId: 'chapter-admin-sec-1',
    })

    const seededInterest = await interestService.submitInterest({
      actorUserId: 'student-security-1',
      joinCode: 'SECORG4A',
      source: 'manual_code',
    })

    const actor: RecruitmentActor = {
      actorUserId: 'chapter-admin-sec-1',
      actorRoles: ['chapter_admin'],
    }

    await expect(
      recruitmentService.listStage1Queue(actor, {
        organizationId: targetOrg.organization.id,
        cycleId: targetOrg.cycle.id,
      })
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      recruitmentService.submitStage1Decision(actor, {
        interestEntryId: seededInterest.entry.id,
        decision: 'yes',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('allows super-admin recruitment decisions across organizations', async () => {
    const targetOrg = await seedOrganization('SECORG4C')
    const seededInterest = await interestService.submitInterest({
      actorUserId: 'student-security-2',
      joinCode: 'SECORG4C',
      source: 'qr',
    })

    const stage1Queue = await recruitmentService.listStage1Queue(
      {
        actorUserId: 'super-admin-actor',
        actorRoles: ['super_admin'],
      },
      {
        organizationId: targetOrg.organization.id,
        cycleId: targetOrg.cycle.id,
      }
    )

    expect(stage1Queue.map((candidate) => candidate.interestEntryId)).toContain(
      seededInterest.entry.id
    )
  })
})
