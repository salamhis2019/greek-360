import { describe, expect, it } from 'vitest'
import {
  createInMemorySuperAdminService,
  type SuperAdminActor,
} from '@/features/super-admin/superAdminService'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-user-1',
  actorRoles: ['super_admin'],
}

describe('Super-admin service constraints', () => {
  it('rejects duplicate university slug values', async () => {
    const service = createInMemorySuperAdminService()

    await service.createUniversity(superAdminActor, {
      name: 'University of Pacific',
      slug: 'university-of-pacific',
      status: 'active',
    })

    await expect(
      service.createUniversity(superAdminActor, {
        name: 'University of Pacific 2',
        slug: 'university-of-pacific',
        status: 'active',
      })
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('rejects invalid organization types', async () => {
    const service = createInMemorySuperAdminService()

    const university = await service.createUniversity(superAdminActor, {
      name: 'University of Central',
      slug: 'university-of-central',
      status: 'active',
    })

    await expect(
      service.createOrganization(superAdminActor, {
        universityId: university.id,
        name: 'Invalid Type Org',
        slug: 'invalid-type-org',
        type: 'club',
        status: 'active',
      })
    ).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('rejects duplicate cycles for the same organization, term, and year', async () => {
    const service = createInMemorySuperAdminService()

    const university = await service.createUniversity(superAdminActor, {
      name: 'North Valley University',
      slug: 'north-valley-university',
      status: 'active',
    })

    const organization = await service.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Theta Sigma',
      slug: 'theta-sigma',
      type: 'fraternity',
      status: 'active',
    })

    await service.createRecruitmentCycle(superAdminActor, {
      organizationId: organization.id,
      term: 'fall',
      year: 2026,
      status: 'active',
    })

    await expect(
      service.createRecruitmentCycle(superAdminActor, {
        organizationId: organization.id,
        term: 'fall',
        year: 2026,
        status: 'draft',
      })
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('rejects invalid join codes and duplicate join links', async () => {
    const service = createInMemorySuperAdminService()

    const university = await service.createUniversity(superAdminActor, {
      name: 'Lakeside University',
      slug: 'lakeside-university',
      status: 'active',
    })

    const organization = await service.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Delta Chi',
      slug: 'delta-chi',
      type: 'fraternity',
      status: 'active',
    })

    const cycle = await service.createRecruitmentCycle(superAdminActor, {
      organizationId: organization.id,
      term: 'spring',
      year: 2027,
      status: 'active',
    })

    await expect(
      service.createJoinLink(superAdminActor, {
        organizationId: organization.id,
        cycleId: cycle.id,
        code: 'bad code',
      })
    ).rejects.toMatchObject({ code: 'invalid_input' })

    await service.createJoinLink(superAdminActor, {
      organizationId: organization.id,
      cycleId: cycle.id,
      code: 'SPRING27',
    })

    await expect(
      service.createJoinLink(superAdminActor, {
        organizationId: organization.id,
        cycleId: cycle.id,
        code: 'SPRING28',
      })
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('rejects duplicate admin assignments', async () => {
    const service = createInMemorySuperAdminService()

    const university = await service.createUniversity(superAdminActor, {
      name: 'West Shore University',
      slug: 'west-shore-university',
      status: 'active',
    })

    const organization = await service.createOrganization(superAdminActor, {
      universityId: university.id,
      name: 'Alpha Delta',
      slug: 'alpha-delta',
      type: 'sorority',
      status: 'active',
    })

    await service.assignOrganizationAdmin(superAdminActor, {
      organizationId: organization.id,
      userId: 'admin-user-55',
    })

    await expect(
      service.assignOrganizationAdmin(superAdminActor, {
        organizationId: organization.id,
        userId: 'admin-user-55',
      })
    ).rejects.toMatchObject({ code: 'conflict' })
  })
})
