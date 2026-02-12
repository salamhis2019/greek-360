import { useMutation, useQuery } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
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

  const [otpCode, setOtpCode] = useState('')
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
        otpCode,
      }),
    onSuccess: async () => {
      setDeletionSuccessMessage('Deletion request submitted.')
      setOtpCode('')
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
    <section className="space-y-4">
      <header className="rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-ui-heading">Privacy settings</h1>
        <p className="mt-2 text-sm text-ui-muted">
          Export your personal data package or request account deletion with OTP re-auth.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ui-heading">Data export</h2>
        <p className="text-sm text-ui-muted">
          Generates a complete JSON data bundle with profile, recruitment, offers, memberships, and
          communication metadata.
        </p>
        <button
          className="rounded-lg border border-ui-border px-3 py-2 text-sm font-medium text-ui-heading"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
          type="button"
        >
          {exportMutation.isPending ? 'Generating export...' : 'Generate export package'}
        </button>
        {exportMutation.isError ? (
          <p className="text-sm text-red-700">{resolveErrorMessage(exportMutation.error)}</p>
        ) : null}
        {latestExport ? (
          <div className="space-y-1 rounded-lg border border-ui-border p-3">
            <p className="text-sm font-medium text-ui-heading">Export package generated</p>
            <p className="text-xs text-ui-muted">Generated: {formatTimestamp(latestExport.generatedAt)}</p>
            {exportSummary ? <p className="text-xs text-ui-muted">{exportSummary}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ui-heading">Delete account</h2>
        <p className="text-sm text-ui-muted">
          Re-enter your OTP code to create a deletion request. Processing is handled asynchronously.
        </p>
        <form className="space-y-3" onSubmit={onRequestDeletion}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-ui-heading" htmlFor="deletion-otp-code">
              One-time passcode
            </label>
            <input
              className="w-full rounded-lg border border-ui-border bg-white px-3 py-2 text-sm text-ui-heading"
              id="deletion-otp-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="123456"
              value={otpCode}
            />
          </div>
          <button
            className="rounded-lg border border-ui-border px-3 py-2 text-sm font-medium text-ui-heading"
            disabled={deletionMutation.isPending}
            type="submit"
          >
            {deletionMutation.isPending ? 'Submitting request...' : 'Request account deletion'}
          </button>
        </form>

        {deletionMutation.isError ? (
          <p className="text-sm text-red-700">{resolveErrorMessage(deletionMutation.error)}</p>
        ) : null}
        {deletionSuccessMessage ? (
          <p className="text-sm text-green-700">{deletionSuccessMessage}</p>
        ) : null}

        {deletionRequestQuery.data ? (
          <div className="space-y-1 rounded-lg border border-ui-border p-3">
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
