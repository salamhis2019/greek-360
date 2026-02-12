import { describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import { messagingService } from '@/features/messaging/messagingService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-security-phase7',
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

describe('Messaging authorization', () => {
  it('denies template creation and send operations for non-admin students', async () => {
    const seeded = await seedOrganization('SECMSG7A')

    await expect(
      messagingService.createTemplate(
        {
          actorUserId: 'student-user-7a',
          actorRoles: ['student'],
        },
        {
          organizationId: seeded.organization.id,
          kind: 'acceptance',
          name: 'Template',
          subject: 'Welcome',
          bodyText: 'Body',
        }
      )
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      messagingService.sendMessage(
        {
          actorUserId: 'student-user-7a',
          actorRoles: ['student'],
        },
        {
          organizationId: seeded.organization.id,
          cycleId: seeded.cycle.id,
          kind: 'acceptance',
          recipientGroup: 'final_yes_pending_offer',
          customSubject: 'Welcome',
          customBodyText: 'Body',
        }
      )
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('denies chapter admin sending messages for an organization they do not manage', async () => {
    const target = await seedOrganization('SECMSG7B')
    const actorOrg = await seedOrganization('SECMSG7C')

    await superAdminService.assignOrganizationAdmin(superAdminActor, {
      organizationId: actorOrg.organization.id,
      userId: 'chapter-admin-sec-msg',
    })

    const interest = await interestService.submitInterest({
      actorUserId: 'student-security-msg',
      joinCode: 'SECMSG7B',
      source: 'manual_code',
    })

    await recruitmentService.submitStage1Decision(
      {
        actorUserId: 'super-admin-user-security-phase7',
        actorRoles: ['super_admin'],
      },
      {
        interestEntryId: interest.entry.id,
        decision: 'yes',
      }
    )
    await recruitmentService.submitStage2Decision(
      {
        actorUserId: 'super-admin-user-security-phase7',
        actorRoles: ['super_admin'],
      },
      {
        interestEntryId: interest.entry.id,
        decision: 'yes',
      }
    )

    await expect(
      messagingService.sendMessage(
        {
          actorUserId: 'chapter-admin-sec-msg',
          actorRoles: ['chapter_admin'],
        },
        {
          organizationId: target.organization.id,
          cycleId: target.cycle.id,
          kind: 'acceptance',
          recipientGroup: 'final_yes_pending_offer',
          customSubject: 'Welcome',
          customBodyText: 'Body',
        }
      )
    ).rejects.toMatchObject({ code: 'forbidden' })
  })
})
