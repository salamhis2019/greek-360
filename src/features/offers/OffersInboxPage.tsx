import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  offerService,
  OfferServiceError,
  type OfferResponseValue,
  type OfferRecord,
} from './offerService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof OfferServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return 'Not responded yet'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

export const OffersInboxPage = () => {
  const { userId } = useAuthSession()
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    offerId: string
    response: OfferResponseValue
  } | null>(null)
  const offersQueryKey = useMemo(() => ['offers', userId], [userId])
  const membershipsQueryKey = useMemo(() => ['memberships', userId], [userId])

  const offersQuery = useQuery({
    queryKey: offersQueryKey,
    queryFn: () => offerService.listOffersForStudent(userId),
  })

  const respondMutation = useMutation({
    mutationFn: ({ offerId, response }: { offerId: string; response: OfferResponseValue }) =>
      offerService.respondToOffer({
        actorUserId: userId,
        offerId,
        response,
      }),
    onMutate: () => {
      setErrorMessage(null)
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error))
    },
    onSuccess: (result) => {
      queryClient.setQueryData<OfferRecord[]>(offersQueryKey, (offers = []) =>
        offers.map((offer) => (offer.id === result.offer.id ? result.offer : offer))
      )
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: offersQueryKey })
      await queryClient.invalidateQueries({ queryKey: membershipsQueryKey })
    },
  })

  const offers = offersQuery.data ?? []

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Offers inbox</h1>
      <p className="text-sm text-ui-muted">
        Review your pending offers and confirm accept or decline.
      </p>

      {offersQuery.isLoading ? <p className="text-sm text-ui-muted">Loading offers...</p> : null}
      {offersQuery.isError ? (
        <p className="text-sm text-red-700">{resolveErrorMessage(offersQuery.error)}</p>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}

      {offers.length === 0 && !offersQuery.isLoading ? (
        <p className="text-sm text-ui-muted">No offers yet.</p>
      ) : null}

      <ul className="space-y-2">
        {offers.map((offer) => {
          const isConfirming = pendingConfirmation?.offerId === offer.id
          const canRespond = offer.status === 'pending' && !respondMutation.isPending

          return (
            <li className="space-y-3 rounded-lg border border-ui-border p-3" key={offer.id}>
              <div>
                <p className="text-sm font-semibold text-ui-heading">Organization: {offer.organizationId}</p>
                <p className="text-xs text-ui-muted">Status: {offer.status}</p>
                <p className="text-xs text-ui-muted">Offered: {formatTimestamp(offer.offeredAt)}</p>
                <p className="text-xs text-ui-muted">Responded: {formatTimestamp(offer.respondedAt)}</p>
                {offer.status === 'accepted' ? (
                  <p className="mt-1 text-xs font-medium text-green-700">Membership active</p>
                ) : null}
              </div>

              {offer.status === 'pending' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="rounded-lg bg-ui-heading px-3 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
                      disabled={!canRespond}
                      onClick={() => setPendingConfirmation({ offerId: offer.id, response: 'accept' })}
                      type="button"
                    >
                      Accept
                    </button>
                    <button
                      className="rounded-lg border border-ui-border px-3 py-2 text-sm font-medium text-ui-heading disabled:opacity-60"
                      disabled={!canRespond}
                      onClick={() => setPendingConfirmation({ offerId: offer.id, response: 'decline' })}
                      type="button"
                    >
                      Decline
                    </button>
                  </div>

                  {isConfirming ? (
                    <div className="space-y-2 rounded-lg border border-ui-border bg-ui-canvas p-3">
                      <p className="text-xs text-ui-body">
                        {pendingConfirmation?.response === 'accept'
                          ? 'Confirm accepting this offer?'
                          : 'Confirm declining this offer?'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="rounded-lg bg-ui-heading px-3 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
                          disabled={respondMutation.isPending}
                          onClick={() => {
                            if (!pendingConfirmation) {
                              return
                            }

                            respondMutation.mutate({
                              offerId: pendingConfirmation.offerId,
                              response: pendingConfirmation.response,
                            })
                            setPendingConfirmation(null)
                          }}
                          type="button"
                        >
                          {pendingConfirmation.response === 'accept' ? 'Confirm accept' : 'Confirm decline'}
                        </button>
                        <button
                          className="rounded-lg border border-ui-border px-3 py-2 text-sm font-medium text-ui-heading"
                          onClick={() => setPendingConfirmation(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
