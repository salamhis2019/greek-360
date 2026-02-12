import { describe, expect, it } from 'vitest'
import { createInMemorySuperAdminService } from '@/features/super-admin/superAdminService'
import type { UserRole } from '@/features/auth/session'

const createActor = (roles: UserRole[]) => ({
  actorUserId: 'actor-user-1',
  actorRoles: roles,
})

describe('Super-admin mutation security', () => {
  it.each([
    { label: 'student', roles: ['student'] as UserRole[] },
    { label: 'chapter admin', roles: ['chapter_admin'] as UserRole[] },
  ])('denies super-admin setup mutations for $label actors', async ({ roles }) => {
    const service = createInMemorySuperAdminService()
    const superAdmin = createActor(['super_admin'])
    const unauthorizedActor = createActor(roles)

    const university = await service.createUniversity(superAdmin, {
      name: 'University of Pacific',
      slug: 'university-of-pacific',
      status: 'active',
    })

    const organization = await service.createOrganization(superAdmin, {
      universityId: university.id,
      name: 'Gamma Eta',
      slug: 'gamma-eta',
      type: 'fraternity',
      status: 'active',
    })

    const cycle = await service.createRecruitmentCycle(superAdmin, {
      organizationId: organization.id,
      term: 'fall',
      year: 2026,
      status: 'active',
    })

    await expect(
      service.createUniversity(unauthorizedActor, {
        name: 'Denied University',
        slug: 'denied-university',
        status: 'active',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      service.createOrganization(unauthorizedActor, {
        universityId: university.id,
        name: 'Denied Org',
        slug: 'denied-org',
        type: 'sorority',
        status: 'active',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      service.createRecruitmentCycle(unauthorizedActor, {
        organizationId: organization.id,
        term: 'spring',
        year: 2027,
        status: 'draft',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      service.createJoinLink(unauthorizedActor, {
        organizationId: organization.id,
        cycleId: cycle.id,
        code: 'FALL2026',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      service.assignOrganizationAdmin(unauthorizedActor, {
        organizationId: organization.id,
        userId: 'admin-user-22',
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
  })
})
