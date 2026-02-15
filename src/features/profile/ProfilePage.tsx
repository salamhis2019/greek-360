import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { offerService, OfferServiceError } from '@/features/offers/offerService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof OfferServiceError) {
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

export const ProfilePage = () => {
  const { userId, displayName } = useAuthSession()

  const membershipsQuery = useQuery({
    queryKey: ['memberships', userId],
    queryFn: () => offerService.listMembershipsForUser(userId),
  })

  const memberships = membershipsQuery.data ?? []
  const activeMembership = memberships.find((membership) => membership.status === 'active') ?? null

  return (
    <section className="ui-page">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Account</p>
        <h1 className="ui-page-title">Profile</h1>
        <p className="ui-page-description">Display name: {displayName ?? 'Unknown user'}</p>
      </header>

      <div className="ui-panel space-y-2">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">Membership status</h2>
        {membershipsQuery.isLoading ? <p className="text-sm text-ui-muted">Loading memberships...</p> : null}
        {membershipsQuery.isError ? (
          <p className="text-sm font-medium text-red-700">{resolveErrorMessage(membershipsQuery.error)}</p>
        ) : null}

        {activeMembership ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-ui-heading">Active membership</p>
            <p className="text-xs text-ui-muted">
              Organization: {activeMembership.organizationName ?? activeMembership.organizationId}
            </p>
            <p className="text-xs text-ui-muted">Joined: {formatTimestamp(activeMembership.joinedAt)}</p>
          </div>
        ) : null}

        {!activeMembership && !membershipsQuery.isLoading ? (
          <p className="text-sm text-ui-muted">No active memberships yet.</p>
        ) : null}
      </div>
    </section>
  )
}
