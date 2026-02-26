import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { AdminContextBanner } from '@/features/admin/AdminContextBanner'
import { adminDashboardService } from '@/features/admin/adminDashboardService'
import {
  AdminMembersServiceError,
  adminMembersService,
} from '@/features/admin/adminMembersService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof AdminMembersServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const AdminMembersPage = () => {
  const params = useParams<{ orgId: string }>()
  const organizationId = params.orgId ?? ''
  const hasOrganizationId = organizationId.length > 0
  const { userId, roles } = useAuthSession()

  const actor = useMemo(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const membersQuery = useQuery({
    queryKey: ['admin-members', organizationId, actor.actorUserId],
    enabled: hasOrganizationId,
    queryFn: () => adminMembersService.listMembers(actor, organizationId),
  })

  const cyclesQuery = useQuery({
    queryKey: ['admin-dashboard', actor.actorUserId, actor.actorRoles],
    queryFn: () => adminDashboardService.listManageableCycles(actor),
  })

  const organizationName =
    cyclesQuery.data?.find((cycle) => cycle.organizationId === organizationId)?.organizationName ??
    organizationId

  if (!hasOrganizationId) {
    return (
      <section className="ui-page-admin space-y-3">
        <header className="ui-page-header">
          <p className="ui-page-brand">Greek 360</p>
          <p className="ui-page-eyebrow">Chapter recruiting</p>
          <h1 className="ui-page-title">Members</h1>
          <p className="ui-page-description">
            Pick an organization from chapter recruiting first.
          </p>
        </header>
        <Link className="ui-btn-secondary w-fit px-4 text-xs" to="/admin">
          Go to chapter recruiting
        </Link>
      </section>
    )
  }

  return (
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Chapter recruiting</p>
        <h1 className="ui-page-title">Members</h1>
        <p className="ui-page-description">Organization: {organizationName}</p>
      </header>

      <div className="ui-action-list">
        <Link className="ui-btn-secondary min-h-[2.2rem] w-full px-4 text-xs sm:w-fit" to="/admin">
          Back to chapter recruiting
        </Link>
      </div>
      <AdminContextBanner organizationId={organizationId} />

      {membersQuery.isLoading ? <p className="text-sm text-ui-muted">Loading members...</p> : null}
      {membersQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(membersQuery.error)}</p>
      ) : null}

      {!membersQuery.isLoading && (membersQuery.data ?? []).length === 0 ? (
        <div className="ui-panel-soft space-y-2">
          <p className="text-sm text-ui-muted">No active members found for this organization yet.</p>
        </div>
      ) : null}

      {(membersQuery.data ?? []).length > 0 ? (
        <ul className="space-y-3">
          {(membersQuery.data ?? []).map((member) => (
            <li className="ui-panel" key={member.userId}>
              <p className="text-sm font-semibold text-ui-heading">{member.name}</p>
              <p className="ui-meta">{member.userId}</p>
              <p className="mt-2 text-xs text-ui-muted">
                Phone: {member.phoneE164 ? member.phoneE164 : 'Hidden'}
              </p>
              <p className="text-xs text-ui-muted">Email: {member.email ? member.email : 'Hidden'}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
