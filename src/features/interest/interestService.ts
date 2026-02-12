import type { SupabaseClient } from '@supabase/supabase-js'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'
import { parseJoinCodeOrThrow } from './joinCode'
import { superAdminService } from '@/features/super-admin/superAdminService'

export type SubmitInterestSource = 'qr' | 'manual_code'

export interface InterestEntryRecord {
  id: string
  userId: string
  organizationId: string
  cycleId: string
  source: SubmitInterestSource
  createdAt: string
}

export interface InterestAuditLogRecord {
  id: string
  actorUserId: string | null
  organizationId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ResolvedJoinCodeRecord {
  organizationId: string
  cycleId: string
  code: string
  organizationName: string
  cycleTerm: string
  cycleYear: number
}

export interface SubmitInterestResult {
  entry: InterestEntryRecord
  wasCreated: boolean
  resolvedJoinCode: ResolvedJoinCodeRecord
}

export type InterestServiceErrorCode =
  | 'unauthenticated'
  | 'invalid_code'
  | 'inactive_code'
  | 'rate_limited'
  | 'invalid_source'
  | 'unknown'

export class InterestServiceError extends Error {
  code: InterestServiceErrorCode

  constructor(code: InterestServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface SubmitInterestParams {
  actorUserId: string | null
  joinCode: string
  source: SubmitInterestSource
}

interface InterestService {
  resolveJoinCode: (joinCode: string) => Promise<ResolvedJoinCodeRecord>
  submitInterest: (params: SubmitInterestParams) => Promise<SubmitInterestResult>
  listInterestEntriesForUser: (userId: string) => Promise<InterestEntryRecord[]>
  listInterestEntriesForOrganizationCycle: (
    organizationId: string,
    cycleId: string
  ) => Promise<InterestEntryRecord[]>
  getInterestEntryById: (interestEntryId: string) => Promise<InterestEntryRecord | null>
  listAuditLogsForActor: (userId: string) => Promise<InterestAuditLogRecord[]>
}

interface ResettableInterestService extends InterestService {
  resetForTests: () => void
}

interface InMemoryInterestStore {
  interestEntries: InterestEntryRecord[]
  auditLogs: InterestAuditLogRecord[]
}

interface InMemoryInterestServiceOptions {
  now?: () => number
  store?: InMemoryInterestStore
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryInterest =
  import.meta.env.MODE === 'test' ||
  forceInMemoryFromSession ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const INVALID_ATTEMPT_WINDOW_MS = 60 * 1000
const MAX_INVALID_ATTEMPTS_PER_WINDOW = 5

const nowIso = () => new Date().toISOString()

const createFallbackId = () => `local-${Math.random().toString(36).slice(2, 12)}`

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return createFallbackId()
}

const createInMemoryStore = (): InMemoryInterestStore => ({
  interestEntries: [],
  auditLogs: [],
})

const sharedInMemoryStore = createInMemoryStore()

const clearStore = (store: InMemoryInterestStore) => {
  store.interestEntries.length = 0
  store.auditLogs.length = 0
}

const mapUnknownToInterestServiceError = (error: unknown): InterestServiceError => {
  if (error instanceof InterestServiceError) {
    return error
  }

  return new InterestServiceError('unknown', 'Something went wrong. Please try again.')
}

const normalizeSourceOrThrow = (source: SubmitInterestSource) => {
  if (source !== 'qr' && source !== 'manual_code') {
    throw new InterestServiceError('invalid_source', 'Interest source is invalid.')
  }

  return source
}

const mapSupabaseMessageToErrorCode = (message: string): InterestServiceErrorCode => {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalizedMessage.includes('rate limit')) {
    return 'rate_limited'
  }

  if (normalizedMessage.includes('inactive') || normalizedMessage.includes('unavailable')) {
    return 'inactive_code'
  }

  if (normalizedMessage.includes('join code') || normalizedMessage.includes('source')) {
    return 'invalid_code'
  }

  return 'unknown'
}

const createInMemoryInterestService = (
  options: InMemoryInterestServiceOptions = {}
): ResettableInterestService => {
  const now = options.now ?? (() => Date.now())
  const store = options.store ?? createInMemoryStore()

  const logAuditEvent = (log: Omit<InterestAuditLogRecord, 'id' | 'createdAt'>) => {
    store.auditLogs.push({
      id: createId(),
      createdAt: nowIso(),
      ...log,
    })
  }

  const countRecentInvalidAttempts = (actorUserId: string) => {
    const windowStart = now() - INVALID_ATTEMPT_WINDOW_MS

    return store.auditLogs.filter((log) => {
      if (log.actorUserId !== actorUserId) {
        return false
      }

      if (
        log.action !== 'interest_submission_invalid_code' &&
        log.action !== 'interest_submission_inactive_code'
      ) {
        return false
      }

      return new Date(log.createdAt).getTime() >= windowStart
    }).length
  }

  const resolveJoinCode = async (joinCode: string): Promise<ResolvedJoinCodeRecord> => {
    let normalizedCode = ''

    try {
      normalizedCode = parseJoinCodeOrThrow(joinCode)
    } catch {
      throw new InterestServiceError(
        'invalid_code',
        'Join code must be 6-12 uppercase letters or numbers.'
      )
    }

    const resolved = await superAdminService.resolveActiveJoinLinkByCode(normalizedCode)

    if (!resolved) {
      throw new InterestServiceError('inactive_code', 'This join code is inactive or unavailable.')
    }

    return resolved
  }

  return {
    async resolveJoinCode(joinCode) {
      return resolveJoinCode(joinCode)
    },

    async submitInterest({ actorUserId, joinCode, source }) {
      if (!actorUserId) {
        throw new InterestServiceError('unauthenticated', 'Authentication is required.')
      }

      const normalizedSource = normalizeSourceOrThrow(source)

      if (countRecentInvalidAttempts(actorUserId) >= MAX_INVALID_ATTEMPTS_PER_WINDOW) {
        throw new InterestServiceError('rate_limited', 'Too many attempts. Try again in a minute.')
      }

      let resolvedJoinCode: ResolvedJoinCodeRecord
      try {
        resolvedJoinCode = await resolveJoinCode(joinCode)
      } catch (error) {
        const interestError = mapUnknownToInterestServiceError(error)

        if (interestError.code === 'invalid_code' || interestError.code === 'inactive_code') {
          logAuditEvent({
            actorUserId,
            organizationId: null,
            action:
              interestError.code === 'invalid_code'
                ? 'interest_submission_invalid_code'
                : 'interest_submission_inactive_code',
            entityType: 'join_link',
            entityId: null,
            metadata: {
              joinCode,
            },
          })
        }

        throw interestError
      }

      const existingEntry = store.interestEntries.find(
        (entry) =>
          entry.userId === actorUserId &&
          entry.organizationId === resolvedJoinCode.organizationId &&
          entry.cycleId === resolvedJoinCode.cycleId
      )

      if (existingEntry) {
        logAuditEvent({
          actorUserId,
          organizationId: resolvedJoinCode.organizationId,
          action: 'interest_submission_duplicate',
          entityType: 'interest_entry',
          entityId: existingEntry.id,
          metadata: {
            cycleId: existingEntry.cycleId,
            joinCode: resolvedJoinCode.code,
            source: normalizedSource,
            wasCreated: false,
          },
        })

        return {
          entry: existingEntry,
          wasCreated: false,
          resolvedJoinCode,
        }
      }

      const createdEntry: InterestEntryRecord = {
        id: createId(),
        userId: actorUserId,
        organizationId: resolvedJoinCode.organizationId,
        cycleId: resolvedJoinCode.cycleId,
        source: normalizedSource,
        createdAt: nowIso(),
      }

      store.interestEntries.push(createdEntry)
      logAuditEvent({
        actorUserId,
        organizationId: resolvedJoinCode.organizationId,
        action: 'interest_submitted',
        entityType: 'interest_entry',
        entityId: createdEntry.id,
        metadata: {
          cycleId: createdEntry.cycleId,
          joinCode: resolvedJoinCode.code,
          source: normalizedSource,
          wasCreated: true,
        },
      })

      return {
        entry: createdEntry,
        wasCreated: true,
        resolvedJoinCode,
      }
    },

    async listInterestEntriesForUser(userId) {
      return store.interestEntries
        .filter((entry) => entry.userId === userId)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    },

    async listInterestEntriesForOrganizationCycle(organizationId, cycleId) {
      return store.interestEntries
        .filter((entry) => entry.organizationId === organizationId && entry.cycleId === cycleId)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    },

    async getInterestEntryById(interestEntryId) {
      return store.interestEntries.find((entry) => entry.id === interestEntryId) ?? null
    },

    async listAuditLogsForActor(userId) {
      return store.auditLogs
        .filter((log) => log.actorUserId === userId)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    },

    resetForTests() {
      clearStore(store)
    },
  }
}

const createSupabaseInterestService = (client: SupabaseClient): InterestService => ({
  async resolveJoinCode(joinCode) {
    let normalizedCode = ''
    try {
      normalizedCode = parseJoinCodeOrThrow(joinCode)
    } catch {
      throw new InterestServiceError(
        'invalid_code',
        'Join code must be 6-12 uppercase letters or numbers.'
      )
    }

    const { data, error } = await client.rpc('resolve_active_join_link', {
      lookup_join_code: normalizedCode,
    })

    if (error) {
      throw new InterestServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = Array.isArray(data) ? data[0] : data

    if (!row) {
      throw new InterestServiceError('inactive_code', 'This join code is inactive or unavailable.')
    }

    return {
      organizationId: row.organization_id as string,
      cycleId: row.cycle_id as string,
      code: row.code as string,
      organizationName: row.organization_name as string,
      cycleTerm: row.cycle_term as string,
      cycleYear: Number(row.cycle_year),
    }
  },

  async submitInterest({ actorUserId, joinCode, source }) {
    if (!actorUserId) {
      throw new InterestServiceError('unauthenticated', 'Authentication is required.')
    }

    const normalizedSource = normalizeSourceOrThrow(source)
    let normalizedCode = ''

    try {
      normalizedCode = parseJoinCodeOrThrow(joinCode)
    } catch {
      throw new InterestServiceError(
        'invalid_code',
        'Join code must be 6-12 uppercase letters or numbers.'
      )
    }

    const { data, error } = await client.rpc('submit_interest', {
      submit_join_code: normalizedCode,
      submit_source: normalizedSource,
    })

    if (error) {
      throw new InterestServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = Array.isArray(data) ? data[0] : data

    if (!row) {
      throw new InterestServiceError('unknown', 'Unexpected response from interest submission.')
    }

    return {
      entry: {
        id: row.id as string,
        userId: row.user_id as string,
        organizationId: row.organization_id as string,
        cycleId: row.cycle_id as string,
        source: row.source as SubmitInterestSource,
        createdAt: row.created_at as string,
      },
      wasCreated: Boolean(row.was_created),
      resolvedJoinCode: {
        organizationId: row.organization_id as string,
        cycleId: row.cycle_id as string,
        code: normalizedCode,
        organizationName: (row.organization_name as string) ?? '',
        cycleTerm: (row.cycle_term as string) ?? '',
        cycleYear: Number(row.cycle_year ?? 0),
      },
    }
  },

  async listInterestEntriesForUser(userId) {
    const { data, error } = await client
      .from('interest_entries')
      .select('id, user_id, organization_id, cycle_id, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new InterestServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      userId: item.user_id as string,
      organizationId: item.organization_id as string,
      cycleId: item.cycle_id as string,
      source: item.source as SubmitInterestSource,
      createdAt: item.created_at as string,
    }))
  },

  async listInterestEntriesForOrganizationCycle(organizationId, cycleId) {
    const { data, error } = await client
      .from('interest_entries')
      .select('id, user_id, organization_id, cycle_id, source, created_at')
      .eq('organization_id', organizationId)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new InterestServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      userId: item.user_id as string,
      organizationId: item.organization_id as string,
      cycleId: item.cycle_id as string,
      source: item.source as SubmitInterestSource,
      createdAt: item.created_at as string,
    }))
  },

  async getInterestEntryById(interestEntryId) {
    const { data, error } = await client
      .from('interest_entries')
      .select('id, user_id, organization_id, cycle_id, source, created_at')
      .eq('id', interestEntryId)
      .maybeSingle()

    if (error) {
      throw new InterestServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    if (!data) {
      return null
    }

    return {
      id: data.id as string,
      userId: data.user_id as string,
      organizationId: data.organization_id as string,
      cycleId: data.cycle_id as string,
      source: data.source as SubmitInterestSource,
      createdAt: data.created_at as string,
    }
  },

  async listAuditLogsForActor(userId) {
    const { data, error } = await client
      .from('audit_logs')
      .select('id, actor_user_id, organization_id, action, entity_type, entity_id, metadata, created_at')
      .eq('actor_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new InterestServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      actorUserId: (item.actor_user_id as string | null) ?? null,
      organizationId: (item.organization_id as string | null) ?? null,
      action: item.action as string,
      entityType: item.entity_type as string,
      entityId: (item.entity_id as string | null) ?? null,
      metadata: (item.metadata as Record<string, unknown>) ?? {},
      createdAt: item.created_at as string,
    }))
  },
})

const sharedInterestService = useInMemoryInterest
  ? createInMemoryInterestService({ store: sharedInMemoryStore })
  : createSupabaseInterestService(supabase)

export const resetInterestServiceForTests = () => {
  if ('resetForTests' in sharedInterestService && typeof sharedInterestService.resetForTests === 'function') {
    sharedInterestService.resetForTests()
  }
}

export const interestService: InterestService = {
  async resolveJoinCode(joinCode) {
    try {
      return await sharedInterestService.resolveJoinCode(joinCode)
    } catch (error) {
      throw mapUnknownToInterestServiceError(error)
    }
  },

  async submitInterest(params) {
    try {
      return await sharedInterestService.submitInterest(params)
    } catch (error) {
      throw mapUnknownToInterestServiceError(error)
    }
  },

  async listInterestEntriesForUser(userId) {
    try {
      return await sharedInterestService.listInterestEntriesForUser(userId)
    } catch (error) {
      throw mapUnknownToInterestServiceError(error)
    }
  },

  async listInterestEntriesForOrganizationCycle(organizationId, cycleId) {
    try {
      return await sharedInterestService.listInterestEntriesForOrganizationCycle(
        organizationId,
        cycleId
      )
    } catch (error) {
      throw mapUnknownToInterestServiceError(error)
    }
  },

  async getInterestEntryById(interestEntryId) {
    try {
      return await sharedInterestService.getInterestEntryById(interestEntryId)
    } catch (error) {
      throw mapUnknownToInterestServiceError(error)
    }
  },

  async listAuditLogsForActor(userId) {
    try {
      return await sharedInterestService.listAuditLogsForActor(userId)
    } catch (error) {
      throw mapUnknownToInterestServiceError(error)
    }
  },
}
