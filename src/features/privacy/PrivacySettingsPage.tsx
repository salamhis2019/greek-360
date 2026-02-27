import { useMutation, useQuery } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { TEST_IDS } from '@/app/testing/testIds'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  privacyService,
  PrivacyServiceError,
  type PrivacyExportBundle,
} from '@/features/privacy/privacyService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof PrivacyServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return 'Pending'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

export const PrivacySettingsPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const [confirmationPhoneNumber, setConfirmationPhoneNumber] = useState('')
  const [latestExport, setLatestExport] = useState<PrivacyExportBundle | null>(null)
  const [deletionSuccessMessage, setDeletionSuccessMessage] = useState<string | null>(null)

  const deletionRequestQuery = useQuery({
    queryKey: ['privacy-deletion-request', userId],
    queryFn: () => privacyService.getMyDeletionRequest(actor),
    enabled: Boolean(userId),
  })

  const exportMutation = useMutation({
    mutationFn: () => privacyService.exportMyData(actor),
    onSuccess: (bundle) => {
      setLatestExport(bundle)
    },
  })

  const deletionMutation = useMutation({
    mutationFn: () =>
      privacyService.requestMyDeletion(actor, {
        phoneNumber: confirmationPhoneNumber,
      }),
    onSuccess: async () => {
      setDeletionSuccessMessage('Deletion request submitted.')
      setConfirmationPhoneNumber('')
      await deletionRequestQuery.refetch()
    },
  })

  const onRequestDeletion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDeletionSuccessMessage(null)
    deletionMutation.mutate()
  }

  const exportSummary = latestExport
    ? [
        `${latestExport.interests.length} interests`,
        `${latestExport.decisions.length} decisions`,
        `${latestExport.offers.length} offers`,
        `${latestExport.memberships.length} memberships`,
      ].join(', ')
    : null

  return (
    <section className="ui-page space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Privacy</p>
        <h1 className="ui-page-title" data-testid={TEST_IDS.privacy.settingsHeading}>
          Privacy settings
        </h1>
        <p className="ui-page-description">
          Export your personal data package or request account deletion with phone confirmation.
        </p>
      </header>

      <section className="ui-panel space-y-3">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ui-heading">Data export</h2>
        <p className="text-sm text-ui-muted">
          Generates a complete JSON data bundle with profile, recruitment, offers, memberships, and
          communication metadata.
        </p>
        <button
          className="ui-btn-secondary px-5"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
          type="button"
        >
          {exportMutation.isPending ? 'Generating export...' : 'Generate export package'}
        </button>
        {exportMutation.isError ? (
          <p className="text-sm font-medium text-red-700">{resolveErrorMessage(exportMutation.error)}</p>
        ) : null}
        {latestExport ? (
          <div className="ui-panel-soft space-y-1">
            <p className="text-sm font-medium text-ui-heading">Export package generated</p>
            <p className="text-xs text-ui-muted">Generated: {formatTimestamp(latestExport.generatedAt)}</p>
            {exportSummary ? <p className="text-xs text-ui-muted">{exportSummary}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="ui-panel space-y-3">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ui-heading">Delete account</h2>
        <p className="text-sm text-ui-muted">
          Re-enter your phone number to create a deletion request.
          Processing is handled asynchronously.
        </p>
        <form className="space-y-3" onSubmit={onRequestDeletion}>
          <div className="space-y-2">
            <label className="ui-label" htmlFor="deletion-phone-confirmation">
              Confirm phone number
            </label>
            <input
              className="ui-input"
              data-testid={TEST_IDS.privacy.deletePhoneInput}
              id="deletion-phone-confirmation"
              inputMode="tel"
              onChange={(event) => setConfirmationPhoneNumber(event.target.value)}
              placeholder="+1 (555) 123-4567"
              value={confirmationPhoneNumber}
            />
          </div>
          <button
            className="ui-btn-secondary px-5"
            disabled={deletionMutation.isPending}
            type="submit"
          >
            {deletionMutation.isPending ? 'Submitting request...' : 'Request account deletion'}
          </button>
        </form>

        {deletionMutation.isError ? (
          <p className="text-sm font-medium text-red-700">{resolveErrorMessage(deletionMutation.error)}</p>
        ) : null}
        {deletionSuccessMessage ? (
          <p className="text-sm font-medium text-green-700">{deletionSuccessMessage}</p>
        ) : null}

        {deletionRequestQuery.data ? (
          <div className="ui-panel-soft space-y-1">
            <p className="text-sm font-medium text-ui-heading">
              Current request status: {deletionRequestQuery.data.status}
            </p>
            <p className="text-xs text-ui-muted">
              Requested: {formatTimestamp(deletionRequestQuery.data.requestedAt)}
            </p>
            <p className="text-xs text-ui-muted">
              Completed: {formatTimestamp(deletionRequestQuery.data.completedAt)}
            </p>
          </div>
        ) : null}
      </section>
    </section>
  )
}
