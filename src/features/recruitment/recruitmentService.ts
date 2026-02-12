import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/features/auth/session'
import {
  interestService,
  type InterestEntryRecord,
  type SubmitInterestSource,
} from '@/features/interest/interestService'
import { superAdminService } from '@/features/super-admin/superAdminService'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export type RecruitmentDecisionStage = 'shortlist' | 'final'
export type RecruitmentDecisionValue = 'yes' | 'no'

export interface RecruitmentActor {
  actorUserId: string | null
  actorRoles: UserRole[]
  adminOrganizationIds?: string[]
}

export interface RecruitmentCandidateRecord {
  interestEntryId: string
  userId: string
  organizationId: string
  cycleId: string
  source: SubmitInterestSource
  createdAt: string
}

export interface RecruitmentDecisionRecord {
  id: string
  interestEntryId: string
  stage: RecruitmentDecisionStage
  decision: RecruitmentDecisionValue
  decidedBy: string
  notes: string | null
  decidedAt: string
}

interface ListQueueParams {
  organizationId: string
  cycleId: string
}

interface SubmitDecisionParams {
  interestEntryId: string
  decision: RecruitmentDecisionValue
  notes?: string | null
}

export type RecruitmentServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_decision'
  | 'invalid_transition'
  | 'unknown'

export class RecruitmentServiceError extends Error {
  code: RecruitmentServiceErrorCode

  constructor(code: RecruitmentServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface RecruitmentService {
  listStage1Queue: (
    actor: RecruitmentActor,
    params: ListQueueParams
  ) => Promise<RecruitmentCandidateRecord[]>
  listStage2Queue: (
    actor: RecruitmentActor,
    params: ListQueueParams
  ) => Promise<RecruitmentCandidateRecord[]>
  submitStage1Decision: (
    actor: RecruitmentActor,
    params: SubmitDecisionParams
  ) => Promise<RecruitmentDecisionRecord>
  submitStage2Decision: (
    actor: RecruitmentActor,
    params: SubmitDecisionParams
  ) => Promise<RecruitmentDecisionRecord>
  listDecisionsForInterestEntry: (
    actor: RecruitmentActor,
    interestEntryId: string
  ) => Promise<RecruitmentDecisionRecord[]>
}

interface ResettableRecruitmentService extends RecruitmentService {
  resetForTests: () => void
}

interface InMemoryRecruitmentStore {
  decisions: RecruitmentDecisionRecord[]
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryRecruitment =
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

const createInMemoryStore = (): InMemoryRecruitmentStore => ({
  decisions: [],
})

const clearStore = (store: InMemoryRecruitmentStore) => {
  store.decisions.length = 0
}

const sharedInMemoryStore = createInMemoryStore()

const normalizeDecisionOrThrow = (value: RecruitmentDecisionValue) => {
  if (value !== 'yes' && value !== 'no') {
    throw new RecruitmentServiceError('invalid_decision', 'Decision must be yes or no.')
  }

  return value
}

const mapSupabaseMessageToErrorCode = (message: string): RecruitmentServiceErrorCode => {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalizedMessage.includes('forbidden')) {
    return 'forbidden'
  }

  if (normalizedMessage.includes('not found')) {
    return 'not_found'
  }

  if (
    normalizedMessage.includes('stage 2 requires') ||
    normalizedMessage.includes('already recorded') ||
    normalizedMessage.includes('transition')
  ) {
    return 'invalid_transition'
  }

  if (normalizedMessage.includes('decision')) {
    return 'invalid_decision'
  }

  return 'unknown'
}

const mapUnknownToRecruitmentServiceError = (error: unknown): RecruitmentServiceError => {
  if (error instanceof RecruitmentServiceError) {
    return error
  }

  return new RecruitmentServiceError('unknown', 'Something went wrong. Please try again.')
}

const readForcedFailureMessage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const message = window.sessionStorage.getItem('greek360.test.failNextRecruitmentDecision')
  if (!message) {
    return null
  }

  window.sessionStorage.removeItem('greek360.test.failNextRecruitmentDecision')
  return message
}

const mapInterestToCandidate = (entry: InterestEntryRecord): RecruitmentCandidateRecord => ({
  interestEntryId: entry.id,
  userId: entry.userId,
  organizationId: entry.organizationId,
  cycleId: entry.cycleId,
  source: entry.source,
  createdAt: entry.createdAt,
})

const createInMemoryRecruitmentService = (
  options: {
    store?: InMemoryRecruitmentStore
  } = {}
): ResettableRecruitmentService => {
  const store = options.store ?? createInMemoryStore()

  const assertAuthorized = async (actor: RecruitmentActor, organizationId: string) => {
    if (!actor.actorUserId) {
      throw new RecruitmentServiceError('unauthenticated', 'Authentication is required.')
    }

    if (actor.actorRoles.includes('super_admin')) {
      return
    }

    if (!actor.actorRoles.includes('chapter_admin')) {
      throw new RecruitmentServiceError('forbidden', 'You are not allowed to make recruitment decisions.')
    }

    const localAssignments = actor.adminOrganizationIds ?? []
    if (localAssignments.includes(organizationId)) {
      return
    }

    const serverAssignments = await superAdminService.listAdminOrganizationIds(actor.actorUserId)
    if (!serverAssignments.includes(organizationId)) {
      throw new RecruitmentServiceError('forbidden', 'You are not allowed to manage this organization.')
    }
  }

  const getInterestEntryOrThrow = async (interestEntryId: string) => {
    const interestEntry = await interestService.getInterestEntryById(interestEntryId)
    if (!interestEntry) {
      throw new RecruitmentServiceError('not_found', 'Interest entry not found.')
    }

    return interestEntry
  }

  const findDecision = (interestEntryId: string, stage: RecruitmentDecisionStage) =>
    store.decisions.find(
      (decision) => decision.interestEntryId === interestEntryId && decision.stage === stage
    )

  return {
    async listStage1Queue(actor, { organizationId, cycleId }) {
      await assertAuthorized(actor, organizationId)
      const entries = await interestService.listInterestEntriesForOrganizationCycle(
        organizationId,
        cycleId
      )

      return entries
        .filter((entry) => !findDecision(entry.id, 'shortlist'))
        .map(mapInterestToCandidate)
    },

    async listStage2Queue(actor, { organizationId, cycleId }) {
      await assertAuthorized(actor, organizationId)
      const entries = await interestService.listInterestEntriesForOrganizationCycle(
        organizationId,
        cycleId
      )

      return entries
        .filter((entry) => findDecision(entry.id, 'shortlist')?.decision === 'yes')
        .filter((entry) => !findDecision(entry.id, 'final'))
        .map(mapInterestToCandidate)
    },

    async submitStage1Decision(actor, { interestEntryId, decision, notes = null }) {
      const forcedFailureMessage = readForcedFailureMessage()
      if (forcedFailureMessage) {
        throw new RecruitmentServiceError('unknown', forcedFailureMessage)
      }

      const normalizedDecision = normalizeDecisionOrThrow(decision)
      const interestEntry = await getInterestEntryOrThrow(interestEntryId)

      await assertAuthorized(actor, interestEntry.organizationId)

      const existing = findDecision(interestEntry.id, 'shortlist')
      if (existing) {
        if (existing.decision === normalizedDecision) {
          return existing
        }

        throw new RecruitmentServiceError(
          'invalid_transition',
          'Stage 1 decision already recorded for this candidate.'
        )
      }

      const createdDecision: RecruitmentDecisionRecord = {
        id: createId(),
        interestEntryId: interestEntry.id,
        stage: 'shortlist',
        decision: normalizedDecision,
        decidedBy: actor.actorUserId ?? '',
        notes,
        decidedAt: nowIso(),
      }

      store.decisions.push(createdDecision)
      return createdDecision
    },

    async submitStage2Decision(actor, { interestEntryId, decision, notes = null }) {
      const forcedFailureMessage = readForcedFailureMessage()
      if (forcedFailureMessage) {
        throw new RecruitmentServiceError('unknown', forcedFailureMessage)
      }

      const normalizedDecision = normalizeDecisionOrThrow(decision)
      const interestEntry = await getInterestEntryOrThrow(interestEntryId)

      await assertAuthorized(actor, interestEntry.organizationId)

      const stage1Decision = findDecision(interestEntry.id, 'shortlist')
      if (!stage1Decision || stage1Decision.decision !== 'yes') {
        throw new RecruitmentServiceError(
          'invalid_transition',
          'Stage 2 requires a prior shortlist yes decision.'
        )
      }

      const existing = findDecision(interestEntry.id, 'final')
      if (existing) {
        if (existing.decision === normalizedDecision) {
          return existing
        }

        throw new RecruitmentServiceError(
          'invalid_transition',
          'Stage 2 decision already recorded for this candidate.'
        )
      }

      const createdDecision: RecruitmentDecisionRecord = {
        id: createId(),
        interestEntryId: interestEntry.id,
        stage: 'final',
        decision: normalizedDecision,
        decidedBy: actor.actorUserId ?? '',
        notes,
        decidedAt: nowIso(),
      }

      store.decisions.push(createdDecision)
      return createdDecision
    },

    async listDecisionsForInterestEntry(actor, interestEntryId) {
      const interestEntry = await getInterestEntryOrThrow(interestEntryId)
      await assertAuthorized(actor, interestEntry.organizationId)

      return store.decisions
        .filter((decision) => decision.interestEntryId === interestEntryId)
        .sort((first, second) => first.decidedAt.localeCompare(second.decidedAt))
    },

    resetForTests() {
      clearStore(store)
    },
  }
}

const mapQueueRowToCandidate = (
  row: Record<string, unknown> | null | undefined
): RecruitmentCandidateRecord | null => {
  if (!row) {
    return null
  }

  return {
    interestEntryId: String(row.interest_entry_id ?? ''),
    userId: String(row.user_id ?? ''),
    organizationId: String(row.organization_id ?? ''),
    cycleId: String(row.cycle_id ?? ''),
    source: String(row.source ?? 'manual_code') as SubmitInterestSource,
    createdAt: String(row.created_at ?? ''),
  }
}

const mapDecisionRow = (
  row: Record<string, unknown> | null | undefined
): RecruitmentDecisionRecord => {
  return {
    id: String(row?.id ?? ''),
    interestEntryId: String(row?.interest_entry_id ?? ''),
    stage: String(row?.stage ?? 'shortlist') as RecruitmentDecisionStage,
    decision: String(row?.decision ?? 'no') as RecruitmentDecisionValue,
    decidedBy: String(row?.decided_by ?? ''),
    notes: (row?.notes as string | null) ?? null,
    decidedAt: String(row?.decided_at ?? nowIso()),
  }
}

const mapQueueRowsToCandidates = (data: unknown): RecruitmentCandidateRecord[] => {
  const rows = Array.isArray(data) ? data : [data]
  return rows
    .map((row) => mapQueueRowToCandidate(row as Record<string, unknown> | null))
    .filter(Boolean) as RecruitmentCandidateRecord[]
}

const createSupabaseRecruitmentService = (client: SupabaseClient): RecruitmentService => ({
  async listStage1Queue(actor, { organizationId, cycleId }) {
    if (!actor.actorUserId) {
      throw new RecruitmentServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('list_recruitment_stage1_queue', {
      queue_organization_id: organizationId,
      queue_cycle_id: cycleId,
    })

    if (error) {
      throw new RecruitmentServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return mapQueueRowsToCandidates(data)
  },

  async listStage2Queue(actor, { organizationId, cycleId }) {
    if (!actor.actorUserId) {
      throw new RecruitmentServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('list_recruitment_stage2_queue', {
      queue_organization_id: organizationId,
      queue_cycle_id: cycleId,
    })

    if (error) {
      throw new RecruitmentServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return mapQueueRowsToCandidates(data)
  },

  async submitStage1Decision(actor, { interestEntryId, decision, notes = null }) {
    if (!actor.actorUserId) {
      throw new RecruitmentServiceError('unauthenticated', 'Authentication is required.')
    }

    const normalizedDecision = normalizeDecisionOrThrow(decision)
    const { data, error } = await client.rpc('write_recruitment_stage1_decision', {
      decision_interest_entry_id: interestEntryId,
      decision_value: normalizedDecision,
      decision_notes: notes,
    })

    if (error) {
      throw new RecruitmentServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = Array.isArray(data) ? data[0] : data
    return mapDecisionRow((row ?? null) as Record<string, unknown> | null)
  },

  async submitStage2Decision(actor, { interestEntryId, decision, notes = null }) {
    if (!actor.actorUserId) {
      throw new RecruitmentServiceError('unauthenticated', 'Authentication is required.')
    }

    const normalizedDecision = normalizeDecisionOrThrow(decision)
    const { data, error } = await client.rpc('write_recruitment_stage2_decision', {
      decision_interest_entry_id: interestEntryId,
      decision_value: normalizedDecision,
      decision_notes: notes,
    })

    if (error) {
      throw new RecruitmentServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = Array.isArray(data) ? data[0] : data
    return mapDecisionRow((row ?? null) as Record<string, unknown> | null)
  },

  async listDecisionsForInterestEntry(actor, interestEntryId) {
    if (!actor.actorUserId) {
      throw new RecruitmentServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client
      .from('recruitment_decisions')
      .select('id, interest_entry_id, stage, decision, decided_by, notes, decided_at')
      .eq('interest_entry_id', interestEntryId)
      .order('decided_at', { ascending: true })

    if (error) {
      throw new RecruitmentServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((row) => mapDecisionRow(row as Record<string, unknown>))
  },
})

const sharedRecruitmentService = useInMemoryRecruitment
  ? createInMemoryRecruitmentService({ store: sharedInMemoryStore })
  : createSupabaseRecruitmentService(supabase)

export const resetRecruitmentServiceForTests = () => {
  if (
    'resetForTests' in sharedRecruitmentService &&
    typeof sharedRecruitmentService.resetForTests === 'function'
  ) {
    sharedRecruitmentService.resetForTests()
  }
}

export const recruitmentService: RecruitmentService = {
  async listStage1Queue(actor, params) {
    try {
      return await sharedRecruitmentService.listStage1Queue(actor, params)
    } catch (error) {
      throw mapUnknownToRecruitmentServiceError(error)
    }
  },

  async listStage2Queue(actor, params) {
    try {
      return await sharedRecruitmentService.listStage2Queue(actor, params)
    } catch (error) {
      throw mapUnknownToRecruitmentServiceError(error)
    }
  },

  async submitStage1Decision(actor, params) {
    try {
      return await sharedRecruitmentService.submitStage1Decision(actor, params)
    } catch (error) {
      throw mapUnknownToRecruitmentServiceError(error)
    }
  },

  async submitStage2Decision(actor, params) {
    try {
      return await sharedRecruitmentService.submitStage2Decision(actor, params)
    } catch (error) {
      throw mapUnknownToRecruitmentServiceError(error)
    }
  },

  async listDecisionsForInterestEntry(actor, interestEntryId) {
    try {
      return await sharedRecruitmentService.listDecisionsForInterestEntry(actor, interestEntryId)
    } catch (error) {
      throw mapUnknownToRecruitmentServiceError(error)
    }
  },
}
