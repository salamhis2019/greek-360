import { beforeEach, describe, expect, it } from 'vitest'
import {
  interestService,
  type SubmitInterestSource,
} from '@/features/interest/interestService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-user-1',
  actorRoles: ['super_admin'],
}

const seedJoinLink = async ({
  code,
  isActive = true,
  cycleStatus = 'active',
}: {
  code: string
  isActive?: boolean
  cycleStatus?: 'draft' | 'active' | 'closed'
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
    status: cycleStatus,
  })

  await superAdminService.createJoinLink(superAdminActor, {
    organizationId: organization.id,
    cycleId: cycle.id,
    code,
    isActive,
  })
}

const submitInterest = async ({
  userId,
  joinCode,
  source,
}: {
  userId: string
  joinCode: string
  source: SubmitInterestSource
}) => {
  return interestService.submitInterest({
    actorUserId: userId,
    joinCode,
    source,
  })
}

describe('Interest submission integration', () => {
  beforeEach(async () => {
    // Force service initialization early for deterministic shared-store usage in tests.
    await interestService.listInterestEntriesForUser('bootstrap-user')
  })

  it('creates one interest entry and stays idempotent for repeated submissions', async () => {
    await seedJoinLink({ code: 'FALL2026' })

    const first = await submitInterest({
      userId: 'student-user-1',
      joinCode: 'FALL2026',
      source: 'qr',
    })

    const second = await submitInterest({
      userId: 'student-user-1',
      joinCode: 'fall-2026',
      source: 'manual_code',
    })

    const entries = await interestService.listInterestEntriesForUser('student-user-1')

    expect(first.wasCreated).toBe(true)
    expect(second.wasCreated).toBe(false)
    expect(second.entry.id).toBe(first.entry.id)
    expect(entries).toHaveLength(1)
  })

  it('rejects invalid join code submissions', async () => {
    await expect(
      submitInterest({
        userId: 'student-user-2',
        joinCode: 'bad!',
        source: 'manual_code',
      })
    ).rejects.toMatchObject({
      code: 'invalid_code',
    })
  })

  it('rejects inactive join code submissions', async () => {
    await seedJoinLink({ code: 'INACTV26', isActive: false })

    await expect(
      submitInterest({
        userId: 'student-user-3',
        joinCode: 'INACTV26',
        source: 'qr',
      })
    ).rejects.toMatchObject({
      code: 'inactive_code',
    })
  })

  it('writes audit logs for both created and idempotent submissions', async () => {
    await seedJoinLink({ code: 'AUDIT226' })

    await submitInterest({
      userId: 'student-user-4',
      joinCode: 'AUDIT226',
      source: 'qr',
    })

    await submitInterest({
      userId: 'student-user-4',
      joinCode: 'AUDIT226',
      source: 'qr',
    })

    const logs = await interestService.listAuditLogsForActor('student-user-4')
    const actions = logs.map((log) => log.action)

    expect(actions).toHaveLength(2)
    expect(actions).toContain('interest_submitted')
    expect(actions).toContain('interest_submission_duplicate')
  })
})
