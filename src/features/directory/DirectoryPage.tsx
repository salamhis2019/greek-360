import { useQuery } from '@tanstack/react-query'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { offerService, OfferServiceError } from '@/features/offers/offerService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof OfferServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const DirectoryPage = () => {
  const { userId } = useAuthSession()

  const membershipsQuery = useQuery({
    queryKey: ['memberships', userId],
    queryFn: () => offerService.listMembershipsForUser(userId),
  })

  const activeMemberships = (membershipsQuery.data ?? []).filter(
    (membership) => membership.status === 'active'
  )

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Directory</h1>
      <p className="text-sm text-ui-muted">
        Campus directory and privacy-gated fields arrive in Phase 6. Your membership state is
        available now.
      </p>

      <div className="space-y-2 rounded-lg border border-ui-border p-4">
        <h2 className="text-sm font-semibold text-ui-heading">Your membership status</h2>
        {membershipsQuery.isLoading ? <p className="text-sm text-ui-muted">Loading status...</p> : null}
        {membershipsQuery.isError ? (
          <p className="text-sm text-red-700">{resolveErrorMessage(membershipsQuery.error)}</p>
        ) : null}

        {activeMemberships.length === 0 && !membershipsQuery.isLoading ? (
          <p className="text-sm text-ui-muted">Inactive</p>
        ) : null}

        {activeMemberships.length > 0 ? (
          <ul className="space-y-1">
            {activeMemberships.map((membership) => (
              <li className="text-sm text-ui-heading" key={membership.id}>
                Active
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
