import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import { PageActionList } from '@/app/ui/PageActionList'
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
  'inline-flex w-fit max-w-full items-center rounded-full border px-2.5 py-1',
  'text-[0.67rem] font-semibold uppercase tracking-[0.08em] leading-tight break-words',
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
    <section className="ui-page space-y-3 overflow-x-hidden">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">My rush</p>
        <h1 className="ui-page-title">My Rush</h1>
        <p className="ui-page-description">
          Run your rush from one place: chapter codes, offers, and your current status.
        </p>
      </header>

      <PageActionList
        actions={[
          { label: 'Join a chapter', to: ROUTE_PATHS.manualCodeEntry, tone: 'primary' },
          { label: 'Open my offers', to: ROUTE_PATHS.offers },
          { label: 'Search campus directory', to: ROUTE_PATHS.directory },
          { label: 'Edit my profile', to: ROUTE_PATHS.profile },
          { label: 'Privacy and data settings', to: ROUTE_PATHS.privacySettings },
        ]}
        title="Quick actions"
      />

      {summaryQuery.isLoading ? <p className="text-sm text-ui-muted">Loading your rush updates...</p> : null}
      {summaryQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(summaryQuery.error)}</p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
            <div className="ui-panel space-y-2 overflow-hidden">
              <p className="ui-subheading">Membership</p>
              {summary.activeMembership ? (
                <>
                  <p className="text-sm font-semibold text-ui-heading break-words">
                    {summary.activeMembership.organizationName}
                  </p>
                  <p className="ui-meta">Joined: {formatTimestamp(summary.activeMembership.joinedAt)}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-ui-muted">No active membership yet.</p>
                  <Link
                    className="ui-btn-secondary mt-1 w-full px-4 text-xs sm:w-auto"
                    to={ROUTE_PATHS.manualCodeEntry}
                  >
                    Enter a join code
                  </Link>
                </>
              )}
            </div>

            <div className="ui-panel space-y-2 overflow-hidden">
              <p className="ui-subheading">Offers</p>
              <p className="text-[1.45rem] font-semibold tracking-[-0.02em] text-ui-heading">
                {summary.pendingOffersCount}
              </p>
              <p className="text-xs text-ui-muted">Pending offers waiting for your response.</p>
              <Link className="ui-btn-secondary mt-1 w-full px-4 text-xs sm:w-auto" to={ROUTE_PATHS.offers}>
                Open offers inbox
              </Link>
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="ui-subheading">Recent interests</h2>
              <Link
                className="ui-btn-secondary min-h-[2.1rem] w-full px-4 text-xs sm:w-auto"
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
                <Link
                  className="ui-btn-primary w-full px-4 text-sm !text-white sm:w-auto"
                  to={ROUTE_PATHS.manualCodeEntry}
                >
                  Enter join code
                </Link>
              </div>
            ) : (
              <ul className="space-y-2 sm:space-y-3">
                {summary.interests.map((interest) => (
                  <li className="ui-panel space-y-2 overflow-hidden" key={interest.interestEntryId}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ui-heading break-words">
                          {interest.organizationName}
                        </p>
                        <p className="ui-meta">
                          {interest.cycleTerm} {interest.cycleYear}
                        </p>
                      </div>
                      <span
                        className={`${interestStatusChipBaseClass} self-start ${
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
