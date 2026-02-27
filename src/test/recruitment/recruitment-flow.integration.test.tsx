import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TEST_IDS } from '@/app/testing/testIds'
import {
  recruitmentService,
  RecruitmentServiceError,
} from '@/features/recruitment/recruitmentService'
import { interestService } from '@/features/interest/interestService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-ui-phase4',
  actorRoles: ['super_admin'],
}

const seedRecruitmentFlow = async ({
  code,
  adminUserId,
  studentUserIds,
}: {
  code: string
  adminUserId: string
  studentUserIds: string[]
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

  for (const studentUserId of studentUserIds) {
    await interestService.submitInterest({
      actorUserId: studentUserId,
      joinCode: code,
      source: 'manual_code',
    })
  }

  return { organization, cycle }
}

describe('Recruitment stage flow integration', () => {
  it('supports one-tap stage 1 decisions and stage 2 final decisions from admin routes', async () => {
    const seeded = await seedRecruitmentFlow({
      code: 'FLOW426A',
      adminUserId: 'chapter-admin-ui-1',
      studentUserIds: ['stageflow-student-1'],
    })

    const seededQueue = await recruitmentService.listStage1Queue(
      {
        actorUserId: 'chapter-admin-ui-1',
        actorRoles: ['chapter_admin'],
      },
      {
        organizationId: seeded.organization.id,
        cycleId: seeded.cycle.id,
      }
    )
    expect(seededQueue.map((candidate) => candidate.userId)).toContain('stageflow-student-1')

    renderAppAtRoute(
      `/admin/recruitment/${seeded.organization.id}/${seeded.cycle.id}/stage-1`,
      {
        isAuthenticated: true,
        userId: 'chapter-admin-ui-1',
        roles: ['chapter_admin'],
      }
    )

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /stage 1 queue/i })).toBeInTheDocument()
    )
    await waitFor(() =>
      expect(screen.getByText(/stageflow-student-1/i)).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /shortlist/i }))

    await waitFor(() =>
      expect(screen.queryByText(/stageflow-student-1/i)).not.toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId(TEST_IDS.recruitment.navStage2Link))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /stage 2 decisions/i })).toBeInTheDocument()
    )
    await waitFor(() =>
      expect(screen.getByText(/stageflow-student-1/i)).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /final no/i }))

    await waitFor(() =>
      expect(screen.queryByText(/stageflow-student-1/i)).not.toBeInTheDocument()
    )
  })

  it('rolls back optimistic stage 1 updates when decision write fails', async () => {
    const seeded = await seedRecruitmentFlow({
      code: 'FLOW426B',
      adminUserId: 'chapter-admin-ui-2',
      studentUserIds: ['rollback-student-1'],
    })

    const submitStage1DecisionSpy = vi
      .spyOn(recruitmentService, 'submitStage1Decision')
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => {
              reject(new RecruitmentServiceError('unknown', 'Decision write failed. Please retry.'))
            }, 0)
          })
      )

    renderAppAtRoute(
      `/admin/recruitment/${seeded.organization.id}/${seeded.cycle.id}/stage-1`,
      {
        isAuthenticated: true,
        userId: 'chapter-admin-ui-2',
        roles: ['chapter_admin'],
      }
    )

    await waitFor(() =>
      expect(screen.getByText(/rollback-student-1/i)).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /shortlist/i }))

    await waitFor(() => expect(screen.queryByText(/rollback-student-1/i)).not.toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByText(/decision write failed\. please retry\./i)).toBeInTheDocument()
    )
    expect(screen.getByText(/rollback-student-1/i)).toBeInTheDocument()

    submitStage1DecisionSpy.mockRestore()
  })
})
