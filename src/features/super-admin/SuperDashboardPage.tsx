import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageActionList } from '@/app/ui/PageActionList'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  SuperAdminServiceError,
  superAdminService,
  type SuperAdminActor,
} from '@/features/super-admin/superAdminService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof SuperAdminServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const SuperDashboardPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo<SuperAdminActor>(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const summaryQuery = useQuery({
    queryKey: ['super-dashboard', actor.actorUserId],
    queryFn: async () => {
      const [universities, organizations, cycles, joinLinks, adminAssignments] = await Promise.all([
        superAdminService.listUniversities(actor),
        superAdminService.listOrganizations(actor),
        superAdminService.listRecruitmentCycles(actor),
        superAdminService.listJoinLinks(actor),
        superAdminService.listOrganizationAdmins(actor),
      ])

      return { universities, organizations, cycles, joinLinks, adminAssignments }
    },
  })

  const summary = summaryQuery.data

  return (
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Campus setup</p>
        <h1 className="ui-page-title">Campus Setup</h1>
        <p className="ui-page-description">
          Set up schools, chapters, and cycles, then hand recruiting off to chapter officers.
        </p>
      </header>
      <PageActionList
        actions={[
          {
            label: 'Manage universities',
            hint: 'Create campus records and status',
            to: '/super/universities',
            tone: 'primary',
          },
          {
            label: 'Manage organizations',
            hint: 'Add fraternities and sororities',
            to: '/super/organizations',
          },
          {
            label: 'Manage recruitment cycles',
            hint: 'Open terms and generate join codes',
            to: '/super/cycles',
          },
          {
            label: 'Manage chapter admin assignments',
            hint: 'Grant or revoke chapter admin access',
            to: '/super/admins',
          },
        ]}
        title="Setup actions"
      />

      {summaryQuery.isLoading ? <p className="text-sm text-ui-muted">Loading campus setup...</p> : null}
      {summaryQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(summaryQuery.error)}</p>
      ) : null}

      {summary ? (
        <ol className="space-y-3">
          <li className="ui-panel space-y-2">
            <p className="ui-subheading">1. Create universities</p>
            <p className="text-sm text-ui-muted">
              {summary.universities.length} configured.
            </p>
            <Link className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs" to="/super/universities">
              Manage universities
            </Link>
          </li>
          <li className="ui-panel space-y-2">
            <p className="ui-subheading">2. Create organizations</p>
            <p className="text-sm text-ui-muted">
              {summary.organizations.length} configured.
            </p>
            <Link className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs" to="/super/organizations">
              Manage organizations
            </Link>
          </li>
          <li className="ui-panel space-y-2">
            <p className="ui-subheading">3. Create cycles and join links</p>
            <p className="text-sm text-ui-muted">
              {summary.cycles.length} cycles · {summary.joinLinks.length} join links.
            </p>
            <Link className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs" to="/super/cycles">
              Manage cycles
            </Link>
          </li>
          <li className="ui-panel space-y-2">
            <p className="ui-subheading">4. Assign chapter admins</p>
            <p className="text-sm text-ui-muted">
              {summary.adminAssignments.length} current admin assignments.
            </p>
            <Link className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs" to="/super/admins">
              Manage admin assignments
            </Link>
          </li>
        </ol>
      ) : null}

      {summary && summary.cycles.length > 0 ? (
        <section className="space-y-2">
          <h2 className="ui-subheading">Validate chapter-admin flow</h2>
          <ul className="space-y-2">
            {summary.cycles.slice(0, 5).map((cycle) => (
              <li className="ui-panel flex flex-wrap items-center justify-between gap-3" key={cycle.id}>
                <p className="text-sm text-ui-heading">
                  {cycle.term} {cycle.year}
                </p>
                <Link
                  className="ui-btn-secondary min-h-[2.1rem] px-4 text-xs"
                  to={`/admin/recruitment/${cycle.organizationId}/${cycle.id}/stage-1`}
                >
                  Open as admin
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}
