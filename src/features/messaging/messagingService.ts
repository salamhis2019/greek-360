import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/features/auth/session'
import { listProfilesForDirectory } from '@/features/auth/authService'
import { interestService } from '@/features/interest/interestService'
import {
  createMessageDedupeKey,
  renderTemplateContent,
  resolveRecipientUserIdsForGroup,
  validateMessageTemplateInput,
  type MessageKind,
  type MessageRecipientGroup,
} from '@/features/messaging/messagingLogic'
import { listOffersForMessaging, type OfferStatus } from '@/features/offers/offerService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService } from '@/features/super-admin/superAdminService'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export interface MessagingActor {
  actorUserId: string | null
  actorRoles: UserRole[]
  adminOrganizationIds?: string[]
}

export interface MessageTemplateRecord {
  id: string
  organizationId: string
  name: string
  kind: MessageKind
  subject: string
  bodyText: string
  bodyHtml: string
  createdBy: string
  createdAt: string
}

export interface EmailFailureRecord {
  userId: string
  email: string
  reason: string
  attempts: number
}

export type EmailJobStatus = 'queued' | 'processing' | 'sent' | 'partial' | 'failed'

export interface EmailJobRecord {
  id: string
  organizationId: string
  cycleId: string
  kind: MessageKind
  recipientGroup: MessageRecipientGroup
  templateId: string | null
  customSubject: string | null
  customBodyText: string | null
  recipientCount: number
  sentCount: number
  failedCount: number
  retriesUsed: number
  status: EmailJobStatus
  dedupeKey: string
  failureDetails: EmailFailureRecord[]
  sentBy: string
  sentAt: string
  recipientUserIds?: string[]
}

export interface MessagingAuditRecord {
  id: string
  actorUserId: string
  organizationId: string
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface MessageSendResult {
  job: EmailJobRecord
  wasDeduplicated: boolean
}

export interface CreateMessageTemplateInput {
  organizationId: string
  kind: MessageKind
  name: string
  subject: string
  bodyText: string
}

export interface SendMessageInput {
  organizationId: string
  cycleId: string
  kind: MessageKind
  recipientGroup: MessageRecipientGroup
  templateId?: string | null
  customSubject?: string | null
  customBodyText?: string | null
  maxRetries?: number
}

type MessagingServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'provider_failure'
  | 'unknown'

export class MessagingServiceError extends Error {
  code: MessagingServiceErrorCode

  constructor(code: MessagingServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface MessagingService {
  listTemplates: (actor: MessagingActor, organizationId: string) => Promise<MessageTemplateRecord[]>
  createTemplate: (
    actor: MessagingActor,
    input: CreateMessageTemplateInput
  ) => Promise<MessageTemplateRecord>
  listJobs: (
    actor: MessagingActor,
    params: { organizationId: string; cycleId: string }
  ) => Promise<EmailJobRecord[]>
  sendMessage: (actor: MessagingActor, input: SendMessageInput) => Promise<MessageSendResult>
  listAuditEventsForOrganization: (
    actor: MessagingActor,
    organizationId: string
  ) => Promise<MessagingAuditRecord[]>
}

interface ResettableMessagingService extends MessagingService {
  resetForTests: () => void
  listAllJobsForPrivacyExport?: () => Promise<EmailJobRecord[]>
}

interface InMemoryMessagingStore {
  templates: MessageTemplateRecord[]
  jobs: EmailJobRecord[]
  auditEvents: MessagingAuditRecord[]
}

interface EmailProviderAdapter {
  send: (input: {
    to: string
    subject: string
    bodyText: string
    bodyHtml: string
  }) => Promise<void>
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryMessaging =
  import.meta.env.MODE === 'test' ||
  forceInMemoryFromSession ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const nowIso = () => new Date().toISOString()
const createFallbackId = () => `local-${Math.random().toString(36).slice(2, 12)}`

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return createFallbackId()
}

const createInMemoryStore = (): InMemoryMessagingStore => ({
  templates: [],
  jobs: [],
  auditEvents: [],
})

const sharedInMemoryStore = createInMemoryStore()

const clearStore = (store: InMemoryMessagingStore) => {
  store.templates.length = 0
  store.jobs.length = 0
  store.auditEvents.length = 0
}

const readProviderFailureCounter = () => {
  if (typeof window === 'undefined') {
    return 0
  }

  const raw = window.sessionStorage.getItem('greek360.test.messageProviderFailuresRemaining')
  if (!raw) {
    return 0
  }

  const count = Number.parseInt(raw, 10)
  if (!Number.isFinite(count) || count <= 0) {
    return 0
  }

  window.sessionStorage.setItem('greek360.test.messageProviderFailuresRemaining', String(count - 1))
  return count
}

const defaultInMemoryProvider: EmailProviderAdapter = {
  async send() {
    if (readProviderFailureCounter() > 0) {
      throw new Error('Provider temporary failure.')
    }
  },
}

const mapSupabaseMessageToErrorCode = (message: string): MessagingServiceErrorCode => {
  const normalized = message.toLowerCase()

  if (normalized.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalized.includes('forbidden') || normalized.includes('permission')) {
    return 'forbidden'
  }

  if (normalized.includes('not found')) {
    return 'not_found'
  }

  if (normalized.includes('provider')) {
    return 'provider_failure'
  }

  if (
    normalized.includes('required') ||
    normalized.includes('invalid') ||
    normalized.includes('must be')
  ) {
    return 'invalid_input'
  }

  return 'unknown'
}

const mapUnknownToMessagingServiceError = (error: unknown): MessagingServiceError => {
  if (error instanceof MessagingServiceError) {
    return error
  }

  return new MessagingServiceError('unknown', 'Something went wrong. Please try again.')
}

const toBodyHtml = (bodyText: string) =>
  `<p>${bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\n/g, '<br/>')}</p>`

const resolveKindOrThrow = (value: string): MessageKind => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'acceptance' || normalized === 'rejection') {
    return normalized
  }

  throw new MessagingServiceError('invalid_input', 'Message kind must be acceptance or rejection.')
}

const resolveRecipientGroupOrThrow = (value: string): MessageRecipientGroup => {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'final_yes_pending_offer' ||
    normalized === 'final_no' ||
    normalized === 'offer_accepted' ||
    normalized === 'offer_declined'
  ) {
    return normalized
  }

  throw new MessagingServiceError('invalid_input', 'Recipient group is invalid.')
}

const createInMemoryMessagingService = (
  options: {
    store?: InMemoryMessagingStore
    provider?: EmailProviderAdapter
  } = {}
): ResettableMessagingService => {
  const store = options.store ?? createInMemoryStore()
  const provider = options.provider ?? defaultInMemoryProvider

  const assertAuthorized = async (actor: MessagingActor, organizationId: string) => {
    if (!actor.actorUserId) {
      throw new MessagingServiceError('unauthenticated', 'Authentication is required.')
    }

    if (actor.actorRoles.includes('super_admin')) {
      return
    }

    if (!actor.actorRoles.includes('chapter_admin')) {
      throw new MessagingServiceError('forbidden', 'Chapter admin or super-admin access is required.')
    }

    const localAssignments = actor.adminOrganizationIds ?? []
    if (localAssignments.includes(organizationId)) {
      return
    }

    const serverAssignments = await superAdminService.listAdminOrganizationIds(actor.actorUserId)
    if (!serverAssignments.includes(organizationId)) {
      throw new MessagingServiceError('forbidden', 'You are not allowed to message this organization.')
    }
  }

  const createAuditEvent = ({
    actorUserId,
    organizationId,
    action,
    entityType,
    entityId,
    metadata,
  }: {
    actorUserId: string
    organizationId: string
    action: string
    entityType: string
    entityId: string | null
    metadata: Record<string, unknown>
  }) => {
    store.auditEvents.push({
      id: createId(),
      actorUserId,
      organizationId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: nowIso(),
    })
  }

  return {
    async listTemplates(actor, organizationId) {
      await assertAuthorized(actor, organizationId)

      return store.templates
        .filter((template) => template.organizationId === organizationId)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    },

    async createTemplate(actor, input) {
      await assertAuthorized(actor, input.organizationId)

      const validated = validateMessageTemplateInput({
        organizationId: input.organizationId,
        createdBy: actor.actorUserId ?? '',
        kind: resolveKindOrThrow(input.kind),
        name: input.name,
        subject: input.subject,
        bodyText: input.bodyText,
      })

      const template: MessageTemplateRecord = {
        id: createId(),
        organizationId: validated.organizationId,
        name: validated.name,
        kind: validated.kind,
        subject: validated.subject,
        bodyText: validated.bodyText,
        bodyHtml: toBodyHtml(validated.bodyText),
        createdBy: validated.createdBy,
        createdAt: nowIso(),
      }

      store.templates.push(template)

      createAuditEvent({
        actorUserId: actor.actorUserId ?? '',
        organizationId: input.organizationId,
        action: 'message_template_created',
        entityType: 'email_template',
        entityId: template.id,
        metadata: {
          kind: template.kind,
          name: template.name,
        },
      })

      return template
    },

    async listJobs(actor, { organizationId, cycleId }) {
      await assertAuthorized(actor, organizationId)

      return store.jobs
        .filter((job) => job.organizationId === organizationId && job.cycleId === cycleId)
        .sort((first, second) => second.sentAt.localeCompare(first.sentAt))
    },

    async sendMessage(actor, input) {
      await assertAuthorized(actor, input.organizationId)

      const kind = resolveKindOrThrow(input.kind)
      const recipientGroup = resolveRecipientGroupOrThrow(input.recipientGroup)
      const cycles = await superAdminService.listRecruitmentCycles({
        actorUserId: 'messaging-system',
        actorRoles: ['super_admin'],
      })

      const cycle = cycles.find(
        (candidate) =>
          candidate.id === input.cycleId && candidate.organizationId === input.organizationId
      )
      if (!cycle) {
        throw new MessagingServiceError('not_found', 'Recruitment cycle not found for this organization.')
      }

      const organizations = await superAdminService.listOrganizations({
        actorUserId: 'messaging-system',
        actorRoles: ['super_admin'],
      })
      const organization = organizations.find((candidate) => candidate.id === input.organizationId)
      if (!organization) {
        throw new MessagingServiceError('not_found', 'Organization not found.')
      }

      let selectedTemplate: MessageTemplateRecord | null = null
      let selectedSubject = ''
      let selectedBodyText = ''

      if (input.templateId) {
        selectedTemplate =
          store.templates.find(
            (template) =>
              template.id === input.templateId &&
              template.organizationId === input.organizationId &&
              template.kind === kind
          ) ?? null

        if (!selectedTemplate) {
          throw new MessagingServiceError('not_found', 'Message template not found.')
        }

        selectedSubject = selectedTemplate.subject
        selectedBodyText = selectedTemplate.bodyText
      } else {
        const validatedCustom = validateMessageTemplateInput({
          organizationId: input.organizationId,
          createdBy: actor.actorUserId ?? '',
          kind,
          name: 'custom',
          subject: input.customSubject ?? '',
          bodyText: input.customBodyText ?? '',
        })

        selectedSubject = validatedCustom.subject
        selectedBodyText = validatedCustom.bodyText
      }

      const interestEntries = await interestService.listInterestEntriesForOrganizationCycle(
        input.organizationId,
        input.cycleId
      )

      const finalDecisionsByInterestEntryId: Record<string, 'yes' | 'no' | null> = {}
      const decisionReads = await Promise.all(
        interestEntries.map((entry) =>
          recruitmentService.listDecisionsForInterestEntry(
            {
              actorUserId: actor.actorUserId,
              actorRoles: actor.actorRoles,
              adminOrganizationIds: actor.adminOrganizationIds,
            },
            entry.id
          )
        )
      )

      interestEntries.forEach((entry, index) => {
        const finalDecision = decisionReads[index]?.find((decision) => decision.stage === 'final')
        finalDecisionsByInterestEntryId[entry.id] = finalDecision?.decision ?? null
      })

      const offers = await listOffersForMessaging()
      const offersByInterestEntryId: Record<string, OfferStatus | null> = {}
      for (const offer of offers) {
        if (
          offer.organizationId === input.organizationId &&
          offer.cycleId === input.cycleId
        ) {
          offersByInterestEntryId[offer.interestEntryId] = offer.status
        }
      }

      const recipientUserIds = resolveRecipientUserIdsForGroup(recipientGroup, {
        interestEntries: interestEntries.map((entry) => ({
          interestEntryId: entry.id,
          userId: entry.userId,
        })),
        finalDecisionsByInterestEntryId,
        offersByInterestEntryId,
      })

      const dedupeKey = createMessageDedupeKey({
        kind,
        cycleId: input.cycleId,
        recipientUserIds,
        subject: selectedSubject,
        bodyText: selectedBodyText,
      })

      const existingJob = store.jobs.find(
        (job) =>
          job.organizationId === input.organizationId &&
          job.cycleId === input.cycleId &&
          job.kind === kind &&
          job.dedupeKey === dedupeKey
      )

      if (existingJob) {
        return {
          job: existingJob,
          wasDeduplicated: true,
        }
      }

      const profiles = await listProfilesForDirectory()
      const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]))
      const recipients = recipientUserIds.map((userId) => {
        const profile = profileByUserId.get(userId)
        return {
          userId,
          name: profile?.name?.trim() ? profile.name : userId,
          email: profile?.email ?? `${userId}@example.test`,
        }
      })

      const maxRetries = Math.max(0, Math.min(5, Math.floor(input.maxRetries ?? 2)))
      const maxAttempts = maxRetries + 1
      const failureDetails: EmailFailureRecord[] = []
      let sentCount = 0
      let retriesUsed = 0

      for (const recipient of recipients) {
        let attempts = 0
        let sent = false
        let lastErrorMessage = 'Provider delivery failed.'

        while (!sent && attempts < maxAttempts) {
          attempts += 1

          try {
            await provider.send({
              to: recipient.email,
              subject: renderTemplateContent(selectedSubject, {
                name: recipient.name,
                organization_name: organization.name,
              }),
              bodyText: renderTemplateContent(selectedBodyText, {
                name: recipient.name,
                organization_name: organization.name,
              }),
              bodyHtml: toBodyHtml(
                renderTemplateContent(selectedBodyText, {
                  name: recipient.name,
                  organization_name: organization.name,
                })
              ),
            })
            sent = true
          } catch (error) {
            const message =
              error instanceof Error && error.message.trim().length > 0
                ? error.message
                : 'Provider delivery failed.'
            lastErrorMessage = message
          }
        }

        retriesUsed += Math.max(0, attempts - 1)

        if (sent) {
          sentCount += 1
          continue
        }

        failureDetails.push({
          userId: recipient.userId,
          email: recipient.email,
          reason: `Provider error: ${lastErrorMessage}`,
          attempts,
        })
      }

      const failedCount = failureDetails.length
      const status: EmailJobStatus =
        failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial'

      const createdJob: EmailJobRecord = {
        id: createId(),
        organizationId: input.organizationId,
        cycleId: input.cycleId,
        kind,
        recipientGroup,
        templateId: selectedTemplate?.id ?? null,
        customSubject: selectedTemplate ? null : selectedSubject,
        customBodyText: selectedTemplate ? null : selectedBodyText,
        recipientCount: recipients.length,
        sentCount,
        failedCount,
        retriesUsed,
        status,
        dedupeKey,
        failureDetails,
        sentBy: actor.actorUserId ?? '',
        sentAt: nowIso(),
        recipientUserIds: [...recipientUserIds],
      }

      store.jobs.push(createdJob)

      createAuditEvent({
        actorUserId: actor.actorUserId ?? '',
        organizationId: input.organizationId,
        action: failedCount > 0 ? 'messages_send_failed' : 'messages_sent',
        entityType: 'email_job',
        entityId: createdJob.id,
        metadata: {
          kind,
          recipient_group: recipientGroup,
          recipient_count: createdJob.recipientCount,
          sent_count: createdJob.sentCount,
          failed_count: createdJob.failedCount,
          dedupe_key: dedupeKey,
        },
      })

      return {
        job: createdJob,
        wasDeduplicated: false,
      }
    },

    async listAuditEventsForOrganization(actor, organizationId) {
      await assertAuthorized(actor, organizationId)

      return store.auditEvents
        .filter((event) => event.organizationId === organizationId)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    },

    resetForTests() {
      clearStore(store)
    },

    async listAllJobsForPrivacyExport() {
      return store.jobs.map((job) => ({
        ...job,
        recipientUserIds: [...(job.recipientUserIds ?? [])],
      }))
    },
  }
}

const mapTemplateRow = (
  row: Record<string, unknown> | null | undefined
): MessageTemplateRecord => ({
  id: String(row?.id ?? ''),
  organizationId: String(row?.organization_id ?? ''),
  name: String(row?.name ?? ''),
  kind: String(row?.type ?? 'acceptance') as MessageKind,
  subject: String(row?.subject ?? ''),
  bodyText: String(row?.body_text ?? ''),
  bodyHtml: String(row?.body_html ?? ''),
  createdBy: String(row?.created_by ?? ''),
  createdAt: String(row?.created_at ?? nowIso()),
})

const mapJobRow = (row: Record<string, unknown> | null | undefined): EmailJobRecord => ({
  id: String(row?.id ?? ''),
  organizationId: String(row?.organization_id ?? ''),
  cycleId: String(row?.cycle_id ?? ''),
  kind: String(row?.kind ?? 'acceptance') as MessageKind,
  recipientGroup: String(row?.recipient_group ?? 'final_yes_pending_offer') as MessageRecipientGroup,
  templateId: (row?.template_id as string | null) ?? null,
  customSubject: (row?.custom_subject as string | null) ?? null,
  customBodyText: (row?.custom_body_text as string | null) ?? null,
  recipientCount: Number(row?.recipient_count ?? 0),
  sentCount: Number(row?.sent_count ?? 0),
  failedCount: Number(row?.failed_count ?? 0),
  retriesUsed: Number(row?.retries_used ?? 0),
  status: String(row?.status ?? 'queued') as EmailJobStatus,
  dedupeKey: String(row?.dedupe_key ?? ''),
  failureDetails: (row?.failure_details as EmailFailureRecord[]) ?? [],
  sentBy: String(row?.sent_by ?? ''),
  sentAt: String(row?.sent_at ?? nowIso()),
  recipientUserIds: Array.isArray(row?.recipient_user_ids)
    ? (row?.recipient_user_ids as string[])
    : [],
})

const mapAuditRow = (row: Record<string, unknown> | null | undefined): MessagingAuditRecord => ({
  id: String(row?.id ?? ''),
  actorUserId: String(row?.actor_user_id ?? ''),
  organizationId: String(row?.organization_id ?? ''),
  action: String(row?.action ?? ''),
  entityType: String(row?.entity_type ?? ''),
  entityId: (row?.entity_id as string | null) ?? null,
  metadata: (row?.metadata as Record<string, unknown>) ?? {},
  createdAt: String(row?.created_at ?? nowIso()),
})

const createSupabaseMessagingService = (client: SupabaseClient): MessagingService => ({
  async listTemplates(actor, organizationId) {
    if (!actor.actorUserId) {
      throw new MessagingServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('list_email_templates', {
      list_organization_id: organizationId,
      list_kind: null,
    })

    if (error) {
      throw new MessagingServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const rows = Array.isArray(data) ? data : [data]
    return rows.map((row) => mapTemplateRow(row as Record<string, unknown> | null))
  },

  async createTemplate(actor, input) {
    if (!actor.actorUserId) {
      throw new MessagingServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('create_email_template', {
      template_organization_id: input.organizationId,
      template_kind: input.kind,
      template_name: input.name,
      template_subject: input.subject,
      template_body_text: input.bodyText,
      template_body_html: toBodyHtml(input.bodyText),
    })

    if (error) {
      throw new MessagingServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return mapTemplateRow((Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null)
  },

  async listJobs(actor, { organizationId, cycleId }) {
    if (!actor.actorUserId) {
      throw new MessagingServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client
      .from('email_jobs')
      .select(
        'id, organization_id, cycle_id, kind, recipient_group, template_id, custom_subject, custom_body_text, recipient_count, sent_count, failed_count, retries_used, status, dedupe_key, failure_details, sent_by, sent_at'
      )
      .eq('organization_id', organizationId)
      .eq('cycle_id', cycleId)
      .order('sent_at', { ascending: false })

    if (error) {
      throw new MessagingServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>))
  },

  async sendMessage(actor, input) {
    if (!actor.actorUserId) {
      throw new MessagingServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('send_cycle_messages', {
      job_organization_id: input.organizationId,
      job_cycle_id: input.cycleId,
      job_kind: input.kind,
      job_recipient_group: input.recipientGroup,
      job_template_id: input.templateId ?? null,
      job_custom_subject: input.customSubject ?? null,
      job_custom_body_text: input.customBodyText ?? null,
      job_custom_body_html: input.customBodyText ? toBodyHtml(input.customBodyText) : null,
      job_max_retries: input.maxRetries ?? 2,
    })

    if (error) {
      throw new MessagingServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
    const job = mapJobRow(row)
    const wasDeduplicated = Boolean(row?.was_deduplicated)

    if (!wasDeduplicated && job.status === 'queued') {
      void client.functions
        .invoke('messages-deliver', {
          body: {
            jobId: job.id,
          },
        })
        .catch(() => undefined)
    }

    return {
      job,
      wasDeduplicated,
    }
  },

  async listAuditEventsForOrganization(actor, organizationId) {
    if (!actor.actorUserId) {
      throw new MessagingServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client
      .from('audit_logs')
      .select('id, actor_user_id, organization_id, action, entity_type, entity_id, metadata, created_at')
      .eq('organization_id', organizationId)
      .in('action', [
        'messages_queued',
        'messages_sent',
        'messages_send_failed',
        'message_template_created',
      ])
      .order('created_at', { ascending: false })

    if (error) {
      throw new MessagingServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((row) => mapAuditRow(row as Record<string, unknown>))
  },
})

const sharedMessagingService = useInMemoryMessaging
  ? createInMemoryMessagingService({ store: sharedInMemoryStore })
  : createSupabaseMessagingService(supabase)

export const resetMessagingServiceForTests = () => {
  if (
    'resetForTests' in sharedMessagingService &&
    typeof sharedMessagingService.resetForTests === 'function'
  ) {
    sharedMessagingService.resetForTests()
  }
}

export const listMessageJobsForPrivacyExport = async (): Promise<EmailJobRecord[]> => {
  if (
    'listAllJobsForPrivacyExport' in sharedMessagingService &&
    typeof sharedMessagingService.listAllJobsForPrivacyExport === 'function'
  ) {
    return sharedMessagingService.listAllJobsForPrivacyExport()
  }

  return []
}

export const messagingService: MessagingService = {
  async listTemplates(actor, organizationId) {
    try {
      return await sharedMessagingService.listTemplates(actor, organizationId)
    } catch (error) {
      throw mapUnknownToMessagingServiceError(error)
    }
  },

  async createTemplate(actor, input) {
    try {
      return await sharedMessagingService.createTemplate(actor, input)
    } catch (error) {
      throw mapUnknownToMessagingServiceError(error)
    }
  },

  async listJobs(actor, params) {
    try {
      return await sharedMessagingService.listJobs(actor, params)
    } catch (error) {
      throw mapUnknownToMessagingServiceError(error)
    }
  },

  async sendMessage(actor, input) {
    try {
      return await sharedMessagingService.sendMessage(actor, input)
    } catch (error) {
      throw mapUnknownToMessagingServiceError(error)
    }
  },

  async listAuditEventsForOrganization(actor, organizationId) {
    try {
      return await sharedMessagingService.listAuditEventsForOrganization(actor, organizationId)
    } catch (error) {
      throw mapUnknownToMessagingServiceError(error)
    }
  },
}
