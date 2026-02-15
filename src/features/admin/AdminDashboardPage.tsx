import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  AdminDashboardServiceError,
  adminDashboardService,
} from '@/features/admin/adminDashboardService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof AdminDashboardServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const AdminDashboardPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const summaryQuery = useQuery({
    queryKey: ['admin-dashboard', actor.actorUserId, actor.actorRoles],
    queryFn: () => adminDashboardService.listManageableCycles(actor),
  })

  const cycles = summaryQuery.data ?? []

  return (
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Chapter admin workspace</p>
        <h1 className="ui-page-title">Admin dashboard</h1>
        <p className="ui-page-description">
          Choose a cycle to run stage decisions, messages, and member operations.
        </p>
      </header>

      {summaryQuery.isLoading ? <p className="text-sm text-ui-muted">Loading admin cycles...</p> : null}
      {summaryQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(summaryQuery.error)}</p>
      ) : null}

      {!summaryQuery.isLoading && cycles.length === 0 ? (
        <div className="ui-panel-soft space-y-2">
          <p className="text-sm text-ui-muted">No organizations are assigned to this admin account yet.</p>
          <p className="text-xs text-ui-muted">
            Ask a super-admin to add your user id on Admin assignments.
          </p>
          <Link className="ui-btn-secondary px-4 text-xs" to="/super/admins">
            Open admin assignments
          </Link>
        </div>
      ) : null}

      {cycles.length > 0 ? (
        <ul className="space-y-3">
          {cycles.map((cycle) => (
            <li className="ui-panel space-y-3" key={cycle.cycleId}>
              <div>
                <p className="text-sm font-semibold text-ui-heading">
                  {cycle.organizationName}
                </p>
                <p className="ui-meta">
                  {cycle.cycleTerm} {cycle.cycleYear} · {cycle.cycleStatus}
                </p>
                <p className="mt-1 text-xs text-ui-muted">
                  Stage 1: {cycle.stage1PendingCount} · Stage 2: {cycle.stage2PendingCount} · Pending offers:{' '}
                  {cycle.pendingOffersCount}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs"
                  to={`/admin/recruitment/${cycle.organizationId}/${cycle.cycleId}/stage-1`}
                >
                  Stage 1
                </Link>
                <Link
                  className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs"
                  to={`/admin/recruitment/${cycle.organizationId}/${cycle.cycleId}/stage-2`}
                >
                  Stage 2
                </Link>
                <Link
                  className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs"
                  to={`/admin/recruitment/${cycle.organizationId}/${cycle.cycleId}/messages`}
                >
                  Messages
                </Link>
                <Link
                  className="ui-btn-secondary min-h-[2.2rem] px-4 text-xs"
                  to={`/admin/members/${cycle.organizationId}`}
                >
                  Members
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
