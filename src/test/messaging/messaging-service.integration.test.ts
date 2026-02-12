import { beforeEach, describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import { messagingService } from '@/features/messaging/messagingService'
import { recruitmentService, type RecruitmentActor } from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-phase7',
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

const createAdminActor = (userId: string): RecruitmentActor => ({
  actorUserId: userId,
  actorRoles: ['chapter_admin'],
})

const seedFinalDecisionState = async ({
  code,
  adminUserId,
  studentUserId,
  finalDecision,
}: {
  code: string
  adminUserId: string
  studentUserId: string
  finalDecision: 'yes' | 'no'
}) => {
  const seeded = await seedRecruitmentCycle(code)
  await superAdminService.assignOrganizationAdmin(superAdminActor, {
    organizationId: seeded.organization.id,
    userId: adminUserId,
  })

  const interest = await interestService.submitInterest({
    actorUserId: studentUserId,
    joinCode: code,
    source: 'manual_code',
  })

  const adminActor = createAdminActor(adminUserId)
  await recruitmentService.submitStage1Decision(adminActor, {
    interestEntryId: interest.entry.id,
    decision: 'yes',
  })
  await recruitmentService.submitStage2Decision(adminActor, {
    interestEntryId: interest.entry.id,
    decision: finalDecision,
  })

  return {
    organizationId: seeded.organization.id,
    cycleId: seeded.cycle.id,
  }
}

describe('Messaging service integration', () => {
  beforeEach(() => {
    window.sessionStorage.removeItem('greek360.test.messageProviderFailuresRemaining')
  })

  it('retries transient provider errors and records a sent job', async () => {
    const seeded = await seedFinalDecisionState({
      code: 'MSG426A',
      adminUserId: 'msg-admin-1',
      studentUserId: 'msg-student-1',
      finalDecision: 'yes',
    })

    const template = await messagingService.createTemplate(
      {
        actorUserId: 'msg-admin-1',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organizationId,
        kind: 'acceptance',
        name: 'Acceptance default',
        subject: 'Welcome {{ name }}',
        bodyText: 'Congrats from {{ organization_name }}.',
      }
    )

    window.sessionStorage.setItem('greek360.test.messageProviderFailuresRemaining', '1')

    const result = await messagingService.sendMessage(
      {
        actorUserId: 'msg-admin-1',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organizationId,
        cycleId: seeded.cycleId,
        kind: 'acceptance',
        recipientGroup: 'final_yes_pending_offer',
        templateId: template.id,
      }
    )

    expect(result.wasDeduplicated).toBe(false)
    expect(result.job.status).toBe('sent')
    expect(result.job.recipientCount).toBe(1)
    expect(result.job.sentCount).toBe(1)
    expect(result.job.failedCount).toBe(0)
    expect(result.job.retriesUsed).toBeGreaterThanOrEqual(1)
  })

  it('prevents duplicate sends for the same dedupe key', async () => {
    const seeded = await seedFinalDecisionState({
      code: 'MSG426B',
      adminUserId: 'msg-admin-2',
      studentUserId: 'msg-student-2',
      finalDecision: 'yes',
    })

    const template = await messagingService.createTemplate(
      {
        actorUserId: 'msg-admin-2',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organizationId,
        kind: 'acceptance',
        name: 'Acceptance default',
        subject: 'Welcome',
        bodyText: 'You have an offer.',
      }
    )

    const first = await messagingService.sendMessage(
      {
        actorUserId: 'msg-admin-2',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organizationId,
        cycleId: seeded.cycleId,
        kind: 'acceptance',
        recipientGroup: 'final_yes_pending_offer',
        templateId: template.id,
      }
    )

    const second = await messagingService.sendMessage(
      {
        actorUserId: 'msg-admin-2',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organizationId,
        cycleId: seeded.cycleId,
        kind: 'acceptance',
        recipientGroup: 'final_yes_pending_offer',
        templateId: template.id,
      }
    )

    expect(first.wasDeduplicated).toBe(false)
    expect(second.wasDeduplicated).toBe(true)
    expect(second.job.id).toBe(first.job.id)
  })

  it('logs failure outcomes when retries are exhausted', async () => {
    const seeded = await seedFinalDecisionState({
      code: 'MSG426C',
      adminUserId: 'msg-admin-3',
      studentUserId: 'msg-student-3',
      finalDecision: 'no',
    })

    window.sessionStorage.setItem('greek360.test.messageProviderFailuresRemaining', '10')

    const result = await messagingService.sendMessage(
      {
        actorUserId: 'msg-admin-3',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organizationId,
        cycleId: seeded.cycleId,
        kind: 'rejection',
        recipientGroup: 'final_no',
        customSubject: 'Update from recruitment',
        customBodyText: 'Thank you for participating.',
        maxRetries: 1,
      }
    )

    expect(result.job.status).toBe('failed')
    expect(result.job.recipientCount).toBe(1)
    expect(result.job.sentCount).toBe(0)
    expect(result.job.failedCount).toBe(1)
    expect(result.job.failureDetails[0]?.reason).toMatch(/provider/i)

    const audits = await messagingService.listAuditEventsForOrganization(
      {
        actorUserId: 'msg-admin-3',
        actorRoles: ['chapter_admin'],
      },
      seeded.organizationId
    )

    expect(audits.some((event) => event.action === 'messages_send_failed')).toBe(true)
  })
})
