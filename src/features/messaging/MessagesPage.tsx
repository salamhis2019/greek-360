import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  type MessageKind,
  type MessageRecipientGroup,
} from '@/features/messaging/messagingLogic'
import { RecruitmentAdminNav } from '@/features/recruitment/RecruitmentAdminNav'
import {
  messagingService,
  MessagingServiceError,
  type MessageSendResult,
  type MessageTemplateRecord,
} from '@/features/messaging/messagingService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof MessagingServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const recipientGroupOptions: Array<{ value: MessageRecipientGroup; label: string }> = [
  { value: 'final_yes_pending_offer', label: 'Final yes + pending offer' },
  { value: 'final_no', label: 'Final no' },
  { value: 'offer_accepted', label: 'Offer accepted' },
  { value: 'offer_declined', label: 'Offer declined' },
]

export const MessagesPage = () => {
  const params = useParams<{ orgId: string; cycleId: string }>()
  const organizationId = params.orgId ?? ''
  const cycleId = params.cycleId ?? ''
  const hasRouteParams = Boolean(organizationId && cycleId)

  const { userId, roles } = useAuthSession()
  const actor = useMemo(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const queryClient = useQueryClient()
  const templateQueryKey = ['messaging', 'templates', organizationId, actor.actorUserId]
  const jobsQueryKey = ['messaging', 'jobs', organizationId, cycleId, actor.actorUserId]

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateKind, setTemplateKind] = useState<MessageKind>('acceptance')
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')

  const [messageKind, setMessageKind] = useState<MessageKind>('acceptance')
  const [recipientGroup, setRecipientGroup] =
    useState<MessageRecipientGroup>('final_yes_pending_offer')
  const [useCustomMessage, setUseCustomMessage] = useState(false)
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [lastSendResult, setLastSendResult] = useState<MessageSendResult | null>(null)

  const templatesQuery = useQuery({
    queryKey: templateQueryKey,
    enabled: hasRouteParams,
    queryFn: () => messagingService.listTemplates(actor, organizationId),
  })

  const jobsQuery = useQuery({
    queryKey: jobsQueryKey,
    enabled: hasRouteParams,
    queryFn: () => messagingService.listJobs(actor, { organizationId, cycleId }),
  })

  const filteredTemplates = (templatesQuery.data ?? []).filter(
    (template) => template.kind === messageKind
  )

  const effectiveUseCustomMessage = useCustomMessage || filteredTemplates.length === 0
  const effectiveSelectedTemplateName = filteredTemplates.some(
    (template) => template.name === selectedTemplateName
  )
    ? selectedTemplateName
    : (filteredTemplates[0]?.name ?? '')

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      messagingService.createTemplate(actor, {
        organizationId,
        kind: templateKind,
        name: templateName,
        subject: templateSubject,
        bodyText: templateBody,
      }),
    onMutate: () => {
      setErrorMessage(null)
    },
    onSuccess: async () => {
      setTemplateName('')
      setTemplateSubject('')
      setTemplateBody('')
      await queryClient.invalidateQueries({ queryKey: templateQueryKey })
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error))
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: ({
      template,
      customPayload,
    }: {
      template: MessageTemplateRecord | null
      customPayload: { subject: string; bodyText: string } | null
    }) =>
      messagingService.sendMessage(actor, {
        organizationId,
        cycleId,
        kind: messageKind,
        recipientGroup,
        templateId: template?.id ?? null,
        customSubject: customPayload?.subject ?? null,
        customBodyText: customPayload?.bodyText ?? null,
      }),
    onMutate: () => {
      setErrorMessage(null)
    },
    onSuccess: async (result) => {
      setLastSendResult(result)
      await queryClient.invalidateQueries({ queryKey: jobsQueryKey })
    },
    onError: (error) => {
      setErrorMessage(resolveErrorMessage(error))
    },
  })

  if (!hasRouteParams) {
    return (
      <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-ui-heading">Messages</h1>
        <p className="text-sm text-red-700">
          Organization and cycle identifiers are required for this route.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Messages</h1>
      <p className="text-sm text-ui-muted">
        Create templates and send acceptance or optional rejection messages to targeted groups.
      </p>
      <RecruitmentAdminNav cycleId={cycleId} organizationId={organizationId} />

      <form
        className="space-y-3 rounded-lg border border-ui-border p-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          createTemplateMutation.mutate()
        }}
      >
        <h2 className="text-sm font-semibold text-ui-heading">Template manager</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="template-name">
            Template name
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            id="template-name"
            onChange={(event) => setTemplateName(event.target.value)}
            value={templateName}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="template-type">
            Template type
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            id="template-type"
            onChange={(event) => setTemplateKind(event.target.value as MessageKind)}
            value={templateKind}
          >
            <option value="acceptance">acceptance</option>
            <option value="rejection">rejection</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="template-subject">
            Template subject
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            id="template-subject"
            onChange={(event) => setTemplateSubject(event.target.value)}
            value={templateSubject}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="template-body">
            Template body
          </label>
          <textarea
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            id="template-body"
            onChange={(event) => setTemplateBody(event.target.value)}
            rows={4}
            value={templateBody}
          />
        </div>
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={createTemplateMutation.isPending}
          type="submit"
        >
          Save template
        </button>
      </form>

      <form
        className="space-y-3 rounded-lg border border-ui-border p-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()

          const selectedTemplate = filteredTemplates.find(
            (template) => template.name === effectiveSelectedTemplateName
          )

          sendMessageMutation.mutate({
            template: effectiveUseCustomMessage ? null : selectedTemplate ?? null,
            customPayload: effectiveUseCustomMessage
              ? {
                  subject: customSubject,
                  bodyText: customBody,
                }
              : null,
          })
        }}
      >
        <h2 className="text-sm font-semibold text-ui-heading">Message composer</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="message-kind">
            Message type
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            id="message-kind"
            onChange={(event) => setMessageKind(event.target.value as MessageKind)}
            value={messageKind}
          >
            <option value="acceptance">acceptance</option>
            <option value="rejection">rejection</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="recipient-group">
            Recipient group
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            id="recipient-group"
            onChange={(event) => setRecipientGroup(event.target.value as MessageRecipientGroup)}
            value={recipientGroup}
          >
            {recipientGroupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ui-body">
          <input
            checked={effectiveUseCustomMessage}
            disabled={filteredTemplates.length === 0}
            onChange={(event) => setUseCustomMessage(event.target.checked)}
            type="checkbox"
          />
          Use custom message
        </label>

        {effectiveUseCustomMessage ? (
          <div className="space-y-3 rounded-lg border border-ui-border bg-ui-canvas p-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="custom-subject">
                Custom subject
              </label>
              <input
                className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
                id="custom-subject"
                onChange={(event) => setCustomSubject(event.target.value)}
                value={customSubject}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="custom-body">
                Custom body
              </label>
              <textarea
                className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
                id="custom-body"
                onChange={(event) => setCustomBody(event.target.value)}
                rows={4}
                value={customBody}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="message-template">
              Template
            </label>
            <select
              className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
              id="message-template"
              onChange={(event) => setSelectedTemplateName(event.target.value)}
              value={effectiveSelectedTemplateName}
            >
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.name}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={sendMessageMutation.isPending}
          type="submit"
        >
          Send message
        </button>
      </form>

      {templatesQuery.isLoading ? <p className="text-sm text-ui-muted">Loading templates...</p> : null}
      {jobsQuery.isLoading ? <p className="text-sm text-ui-muted">Loading message jobs...</p> : null}
      {templatesQuery.isError ? (
        <p className="text-sm text-red-700">{resolveErrorMessage(templatesQuery.error)}</p>
      ) : null}
      {jobsQuery.isError ? (
        <p className="text-sm text-red-700">{resolveErrorMessage(jobsQuery.error)}</p>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}

      {lastSendResult ? (
        <div className="space-y-2 rounded-lg border border-ui-border bg-ui-canvas p-3">
          <p className="text-sm font-medium text-ui-heading">
            {lastSendResult.wasDeduplicated
              ? 'Duplicate send prevented. Existing send result reused.'
              : `Sent ${lastSendResult.job.sentCount} of ${
                  lastSendResult.job.recipientCount
                } recipients.`}
          </p>
          {lastSendResult.job.failedCount > 0 ? (
            <ul className="space-y-1">
              {lastSendResult.job.failureDetails.map((failure) => (
                <li className="text-xs text-red-700" key={`${failure.userId}-${failure.email}`}>
                  {failure.userId}: {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Saved templates</h2>
        {(templatesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-ui-muted">No templates saved yet.</p>
        ) : (
          <ul className="space-y-2">
            {(templatesQuery.data ?? []).map((template) => (
              <li className="rounded-lg border border-ui-border p-3" key={template.id}>
                <p className="text-sm font-semibold text-ui-heading">{template.name}</p>
                <p className="text-xs text-ui-muted">
                  {template.kind} | Subject: {template.subject}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Recent sends</h2>
        {(jobsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-ui-muted">No messages sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {(jobsQuery.data ?? []).map((job) => (
              <li className="rounded-lg border border-ui-border p-3" key={job.id}>
                <p className="text-sm font-semibold text-ui-heading">
                  {job.kind} | {job.recipientGroup}
                </p>
                <p className="text-xs text-ui-muted">
                  Status: {job.status} | Sent {job.sentCount}/{job.recipientCount}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
