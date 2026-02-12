import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { interestService } from '@/features/interest/interestService'
import {
  recruitmentService,
  type RecruitmentActor,
} from '@/features/recruitment/recruitmentService'
import { superAdminService, type SuperAdminActor } from '@/features/super-admin/superAdminService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const superAdminActor: SuperAdminActor = {
  actorUserId: 'super-admin-ui-phase7',
  actorRoles: ['super_admin'],
}

const seedMessagingFlow = async ({
  code,
  adminUserId,
  yesStudentUserId,
  noStudentUserId,
}: {
  code: string
  adminUserId: string
  yesStudentUserId: string
  noStudentUserId: string
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

  const yesInterest = await interestService.submitInterest({
    actorUserId: yesStudentUserId,
    joinCode: code,
    source: 'manual_code',
  })
  const noInterest = await interestService.submitInterest({
    actorUserId: noStudentUserId,
    joinCode: code,
    source: 'manual_code',
  })

  const adminActor: RecruitmentActor = {
    actorUserId: adminUserId,
    actorRoles: ['chapter_admin'],
  }

  await recruitmentService.submitStage1Decision(adminActor, {
    interestEntryId: yesInterest.entry.id,
    decision: 'yes',
  })
  await recruitmentService.submitStage2Decision(adminActor, {
    interestEntryId: yesInterest.entry.id,
    decision: 'yes',
  })

  await recruitmentService.submitStage1Decision(adminActor, {
    interestEntryId: noInterest.entry.id,
    decision: 'yes',
  })
  await recruitmentService.submitStage2Decision(adminActor, {
    interestEntryId: noInterest.entry.id,
    decision: 'no',
  })

  return { organization, cycle }
}

describe('Messaging flow integration', () => {
  it('lets chapter admin create templates and send acceptance and rejection messages', async () => {
    const seeded = await seedMessagingFlow({
      code: 'MSGFLOW1',
      adminUserId: 'chapter-admin-ui-7',
      yesStudentUserId: 'phase7-student-yes',
      noStudentUserId: 'phase7-student-no',
    })

    renderAppAtRoute(`/admin/recruitment/${seeded.organization.id}/${seeded.cycle.id}/messages`, {
      isAuthenticated: true,
      userId: 'chapter-admin-ui-7',
      roles: ['chapter_admin'],
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /^messages$/i })).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/template name/i), {
      target: { value: 'Acceptance default' },
    })
    fireEvent.change(screen.getByLabelText(/template type/i), {
      target: { value: 'acceptance' },
    })
    fireEvent.change(screen.getByLabelText(/template subject/i), {
      target: { value: 'Welcome {{ name }}' },
    })
    fireEvent.change(screen.getByLabelText(/template body/i), {
      target: { value: 'Congrats from {{ organization_name }}.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save template/i }))

    await waitFor(() =>
      expect(screen.getAllByText(/acceptance default/i).length).toBeGreaterThan(0)
    )

    fireEvent.change(screen.getByLabelText(/message type/i), {
      target: { value: 'acceptance' },
    })
    fireEvent.change(screen.getByLabelText(/recipient group/i), {
      target: { value: 'final_yes_pending_offer' },
    })
    fireEvent.change(screen.getByLabelText(/^template$/i), {
      target: { value: 'Acceptance default' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() =>
      expect(screen.getByText(/sent 1 of 1 recipients/i)).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/message type/i), {
      target: { value: 'rejection' },
    })
    fireEvent.change(screen.getByLabelText(/recipient group/i), {
      target: { value: 'final_no' },
    })
    fireEvent.click(screen.getByLabelText(/use custom message/i))
    fireEvent.change(screen.getByLabelText(/custom subject/i), {
      target: { value: 'Recruitment update' },
    })
    fireEvent.change(screen.getByLabelText(/custom body/i), {
      target: { value: 'Thanks for your interest this cycle.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() =>
      expect(screen.getByText(/sent 1 of 1 recipients/i)).toBeInTheDocument()
    )
  })
})
