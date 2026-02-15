import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  StudentDashboardServiceError,
  studentDashboardService,
  type StudentInterestStatus,
} from '@/features/student/studentDashboardService'

const statusLabel: Record<StudentInterestStatus, string> = {
  submitted: 'Submitted',
  offer_pending: 'Offer pending',
  offer_accepted: 'Offer accepted',
  offer_declined: 'Offer declined',
  offer_expired: 'Offer expired',
  membership_active: 'Membership active',
}

const statusClassName: Record<StudentInterestStatus, string> = {
  submitted: 'border-black/10 bg-white text-ui-heading',
  offer_pending: 'border-amber-300 bg-amber-50 text-amber-800',
  offer_accepted: 'border-green-300 bg-green-50 text-green-800',
  offer_declined: 'border-red-200 bg-red-50 text-red-800',
  offer_expired: 'border-slate-300 bg-slate-100 text-slate-700',
  membership_active: 'border-emerald-300 bg-emerald-50 text-emerald-800',
}

const interestStatusChipBaseClass = [
  'inline-flex items-center rounded-full border px-2.5 py-1',
  'text-[0.67rem] font-semibold uppercase tracking-[0.08em]',
].join(' ')

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof StudentDashboardServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const formatTimestamp = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

export const StudentHomePage = () => {
  const { userId } = useAuthSession()

  const summaryQuery = useQuery({
    queryKey: ['student-dashboard', userId],
    queryFn: () => studentDashboardService.getSummary(userId),
  })

  const summary = summaryQuery.data

  return (
    <section className="ui-page space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Student workspace</p>
        <h1 className="ui-page-title">Student home</h1>
        <p className="ui-page-description">
          Track your active membership, offers, and recruitment progress in one place.
        </p>
      </header>

      {summaryQuery.isLoading ? <p className="text-sm text-ui-muted">Loading your dashboard...</p> : null}
      {summaryQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(summaryQuery.error)}</p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="ui-panel space-y-2">
              <p className="ui-subheading">Membership</p>
              {summary.activeMembership ? (
                <>
                  <p className="text-sm font-semibold text-ui-heading">
                    {summary.activeMembership.organizationName}
                  </p>
                  <p className="ui-meta">Joined: {formatTimestamp(summary.activeMembership.joinedAt)}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-ui-muted">No active membership yet.</p>
                  <Link className="ui-btn-secondary mt-1 px-4 text-xs" to={ROUTE_PATHS.manualCodeEntry}>
                    Enter a join code
                  </Link>
                </>
              )}
            </div>

            <div className="ui-panel space-y-2">
              <p className="ui-subheading">Offers</p>
              <p className="text-[1.45rem] font-semibold tracking-[-0.02em] text-ui-heading">
                {summary.pendingOffersCount}
              </p>
              <p className="text-xs text-ui-muted">Pending offers waiting for your response.</p>
              <Link className="ui-btn-secondary mt-1 px-4 text-xs" to={ROUTE_PATHS.offers}>
                Open offers inbox
              </Link>
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="ui-subheading">Recent interests</h2>
              <Link
                className="text-xs font-semibold uppercase tracking-[0.08em] text-ui-heading underline underline-offset-4"
                to={ROUTE_PATHS.manualCodeEntry}
              >
                Add chapter
              </Link>
            </div>

            {summary.interests.length === 0 ? (
              <div className="ui-panel-soft space-y-2">
                <p className="text-sm text-ui-muted">No interests submitted yet.</p>
                <p className="text-xs text-ui-muted">
                  Start by entering a chapter join code from recruitment events.
                </p>
                <Link className="ui-btn-primary px-4 text-sm" to={ROUTE_PATHS.manualCodeEntry}>
                  Enter join code
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {summary.interests.map((interest) => (
                  <li className="ui-panel space-y-2" key={interest.interestEntryId}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ui-heading">{interest.organizationName}</p>
                        <p className="ui-meta">
                          {interest.cycleTerm} {interest.cycleYear}
                        </p>
                      </div>
                      <span
                        className={`${interestStatusChipBaseClass} ${
                          statusClassName[interest.status]
                        }`}
                      >
                        {statusLabel[interest.status]}
                      </span>
                    </div>
                    <p className="ui-meta">Submitted {formatTimestamp(interest.submittedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}
