import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { adminDashboardService } from '@/features/admin/adminDashboardService'

interface AdminContextBannerProps {
  organizationId: string
  cycleId?: string
}

export const AdminContextBanner = ({ organizationId, cycleId }: AdminContextBannerProps) => {
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

  const cycleSummary = summaryQuery.data?.find(
    (summary) =>
      summary.organizationId === organizationId &&
      (!cycleId || summary.cycleId === cycleId)
  )
  const organizationName = cycleSummary?.organizationName ?? organizationId
  const cycleLabel = cycleSummary ? `${cycleSummary.cycleTerm} ${cycleSummary.cycleYear}` : null

  return (
    <section className="ui-panel-soft flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black/55">Current context</p>
        <p className="text-sm font-semibold text-ui-heading">
          {organizationName}
          {cycleLabel ? ` · ${cycleLabel}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="ui-btn-secondary min-h-[2.1rem] px-3 text-xs" to="/admin">
          Switch cycle
        </Link>
        {cycleId ? (
          <Link className="ui-btn-secondary min-h-[2.1rem] px-3 text-xs" to={`/admin/members/${organizationId}`}>
            Members
          </Link>
        ) : null}
      </div>
    </section>
  )
}
