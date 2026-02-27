import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TEST_IDS } from '@/app/testing/testIds'
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

const statusClassByOfferStatus = {
  pending: 'border-amber-300 bg-amber-50 text-amber-800',
  accepted: 'border-green-300 bg-green-50 text-green-800',
  declined: 'border-red-200 bg-red-50 text-red-800',
  expired: 'border-slate-300 bg-slate-100 text-slate-700',
} as const

const offerStatusChipBaseClass = [
  'mt-1 inline-flex rounded-full border px-2.5 py-1',
  'text-[0.67rem] font-semibold uppercase tracking-[0.08em]',
].join(' ')

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
    <section className="ui-page">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Offers</p>
        <h1 className="ui-page-title" data-testid={TEST_IDS.offers.inboxHeading}>
          Offers inbox
        </h1>
        <p className="ui-page-description">Review your pending offers and confirm accept or decline.</p>
      </header>

      {offersQuery.isLoading ? <p className="text-sm text-ui-muted">Loading offers...</p> : null}
      {offersQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(offersQuery.error)}</p>
      ) : null}
      {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}

      {offers.length === 0 && !offersQuery.isLoading ? (
        <p className="text-sm text-ui-muted">No offers yet.</p>
      ) : null}

      <ul className="space-y-3">
        {offers.map((offer) => {
          const isConfirming = pendingConfirmation?.offerId === offer.id
          const canRespond = offer.status === 'pending' && !respondMutation.isPending

          return (
            <li className="ui-panel space-y-3" key={offer.id}>
              <div>
                <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">
                  Organization: {offer.organizationName ?? offer.organizationId}
                </p>
                <p className="ui-meta">
                  Cycle:{' '}
                  {offer.cycleTerm && offer.cycleYear
                    ? `${offer.cycleTerm} ${offer.cycleYear}`
                    : offer.cycleId}
                </p>
                <span
                  className={`${offerStatusChipBaseClass} ${
                    statusClassByOfferStatus[offer.status]
                  }`}
                >
                  {offer.status}
                </span>
                <p className="ui-meta">Offered: {formatTimestamp(offer.offeredAt)}</p>
                <p className="ui-meta">Responded: {formatTimestamp(offer.respondedAt)}</p>
                {offer.status === 'accepted' ? (
                  <p className="mt-1 text-xs font-semibold text-green-700">Membership active</p>
                ) : null}
              </div>

              {offer.status === 'pending' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="ui-btn-primary min-h-[2.85rem] rounded-full text-sm"
                      disabled={!canRespond}
                      onClick={() => setPendingConfirmation({ offerId: offer.id, response: 'accept' })}
                      type="button"
                    >
                      Accept
                    </button>
                    <button
                      className="ui-btn-secondary min-h-[2.85rem] rounded-full text-sm"
                      disabled={!canRespond}
                      onClick={() => setPendingConfirmation({ offerId: offer.id, response: 'decline' })}
                      type="button"
                    >
                      Decline
                    </button>
                  </div>

                  {isConfirming ? (
                    <div className="ui-panel-soft space-y-3">
                      <p className="text-xs font-medium text-ui-body">
                        {pendingConfirmation?.response === 'accept'
                          ? 'Confirm accepting this offer?'
                          : 'Confirm declining this offer?'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="ui-btn-primary min-h-[2.7rem] rounded-full text-sm"
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
                          className="ui-btn-secondary min-h-[2.7rem] rounded-full text-sm"
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
