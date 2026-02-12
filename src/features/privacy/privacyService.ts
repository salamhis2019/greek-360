import type { SupabaseClient } from '@supabase/supabase-js'
import { type UserProfileRecord, listProfilesForDirectory } from '@/features/auth/authService'
import type { UserRole } from '@/features/auth/session'
import { type InterestEntryRecord, interestService } from '@/features/interest/interestService'
import {
  listMessageJobsForPrivacyExport,
  type EmailJobRecord,
} from '@/features/messaging/messagingService'
import {
  type MembershipRecord,
  type OfferRecord,
  offerService,
} from '@/features/offers/offerService'
import { type RecruitmentDecisionRecord, recruitmentService } from '@/features/recruitment/recruitmentService'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'
import { isUserDeleted, markUserDeleted, resetDeletedUsersForTests } from './privacyDeletionState'

export { isUserDeleted }

export type DeletionRequestStatus = 'requested' | 'processing' | 'completed' | 'rejected'

export interface PrivacyActor {
  actorUserId: string | null
  actorRoles: UserRole[]
}

export interface DeletionRequestRecord {
  id: string
  userId: string
  status: DeletionRequestStatus
  requestedAt: string
  completedAt: string | null
}

export interface PrivacyCommunicationRecord {
  jobId: string
  organizationId: string
  cycleId: string
  kind: EmailJobRecord['kind']
  recipientGroup: EmailJobRecord['recipientGroup']
  direction: 'sent' | 'received'
  sentAt: string
}

export interface PrivacyExportBundle {
  generatedAt: string
  profile: UserProfileRecord
  interests: InterestEntryRecord[]
  decisions: RecruitmentDecisionRecord[]
  offers: OfferRecord[]
  memberships: MembershipRecord[]
  communications: PrivacyCommunicationRecord[]
}

export type PrivacyServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_reauth'
  | 'rate_limited'
  | 'not_found'
  | 'invalid_state'
  | 'already_deleted'
  | 'unknown'

export class PrivacyServiceError extends Error {
  code: PrivacyServiceErrorCode

  constructor(code: PrivacyServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface RequestDeletionInput {
  otpCode: string
}

interface ProcessDeletionInput {
  requestId: string
}

interface PrivacyService {
  exportMyData: (actor: PrivacyActor) => Promise<PrivacyExportBundle>
  requestMyDeletion: (
    actor: PrivacyActor,
    input: RequestDeletionInput
  ) => Promise<DeletionRequestRecord>
  getMyDeletionRequest: (actor: PrivacyActor) => Promise<DeletionRequestRecord | null>
  processDeletionRequest: (
    actor: PrivacyActor,
    input: ProcessDeletionInput
  ) => Promise<DeletionRequestRecord>
}

interface ResettablePrivacyService extends PrivacyService {
  resetForTests: () => void
}

interface InMemoryPrivacyStore {
  deletionRequests: DeletionRequestRecord[]
  invalidOtpAttemptsByUserId: Map<string, number[]>
}

interface InMemoryPrivacyOptions {
  now?: () => number
  store?: InMemoryPrivacyStore
}

const DELETE_REAUTH_CODE = '123456'
const INVALID_OTP_WINDOW_MS = 60 * 1000
const MAX_INVALID_OTP_ATTEMPTS = 5

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryPrivacy =
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

const createInMemoryStore = (): InMemoryPrivacyStore => ({
  deletionRequests: [],
  invalidOtpAttemptsByUserId: new Map(),
})

const sharedInMemoryStore = createInMemoryStore()

const clearStore = (store: InMemoryPrivacyStore) => {
  store.deletionRequests.length = 0
  store.invalidOtpAttemptsByUserId.clear()
}

const mapUnknownToPrivacyError = (error: unknown): PrivacyServiceError => {
  if (error instanceof PrivacyServiceError) {
    return error
  }

  return new PrivacyServiceError('unknown', 'Something went wrong. Please try again.')
}

const mapSupabaseErrorCode = (message: string): PrivacyServiceErrorCode => {
  const normalized = message.toLowerCase()

  if (normalized.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalized.includes('forbidden')) {
    return 'forbidden'
  }

  if (normalized.includes('otp') || normalized.includes('verification')) {
    return 'invalid_reauth'
  }

  if (normalized.includes('rate')) {
    return 'rate_limited'
  }

  if (normalized.includes('not found')) {
    return 'not_found'
  }

  if (normalized.includes('already deleted') || normalized.includes('deleted user')) {
    return 'already_deleted'
  }

  if (normalized.includes('state')) {
    return 'invalid_state'
  }

  return 'unknown'
}

const assertAuthenticatedActor = (actor: PrivacyActor) => {
  if (!actor.actorUserId) {
    throw new PrivacyServiceError('unauthenticated', 'Authentication is required.')
  }

  if (isUserDeleted(actor.actorUserId)) {
    throw new PrivacyServiceError('already_deleted', 'This account has already been deleted.')
  }

  return actor.actorUserId
}

const assertCanProcessDeletion = (actor: PrivacyActor) => {
  if (!actor.actorUserId) {
    throw new PrivacyServiceError('unauthenticated', 'Authentication is required.')
  }

  if (!actor.actorRoles.includes('super_admin')) {
    throw new PrivacyServiceError('forbidden', 'Only super-admin can process deletion requests.')
  }
}

const resolveProfileForUser = async (userId: string): Promise<UserProfileRecord> => {
  const profiles = await listProfilesForDirectory()
  const matchedProfile = profiles.find((profile) => profile.userId === userId)

  if (matchedProfile) {
    return matchedProfile
  }

  return {
    userId,
    phoneE164: '',
    name: '',
    email: null,
  }
}

const resolveDecisionsForInterests = async (interests: InterestEntryRecord[]) => {
  if (interests.length === 0) {
    return [] as RecruitmentDecisionRecord[]
  }

  const results = await Promise.all(
    interests.map((interest) =>
      recruitmentService.listDecisionsForInterestEntry(
        {
          actorUserId: 'privacy-system',
          actorRoles: ['super_admin'],
        },
        interest.id
      )
    )
  )

  return results.flat()
}

const resolveRelevantCommunications = async (
  userId: string
): Promise<PrivacyCommunicationRecord[]> => {
  const jobs = await listMessageJobsForPrivacyExport()

  return jobs
    .filter((job) => job.sentBy === userId || (job.recipientUserIds ?? []).includes(userId))
    .map((job) => {
      const direction: PrivacyCommunicationRecord['direction'] =
        job.sentBy === userId ? 'sent' : 'received'

      return {
        jobId: job.id,
        organizationId: job.organizationId,
        cycleId: job.cycleId,
        kind: job.kind,
        recipientGroup: job.recipientGroup,
        direction,
        sentAt: job.sentAt,
      }
    })
    .sort((first, second) => second.sentAt.localeCompare(first.sentAt))
}

const buildExportBundle = async (userId: string): Promise<PrivacyExportBundle> => {
  const profile = await resolveProfileForUser(userId)
  const interests = await interestService.listInterestEntriesForUser(userId)
  const decisions = await resolveDecisionsForInterests(interests)
  const offers = await offerService.listOffersForStudent(userId)
  const memberships = await offerService.listMembershipsForUser(userId)
  const communications = await resolveRelevantCommunications(userId)

  return {
    generatedAt: nowIso(),
    profile,
    interests,
    decisions,
    offers,
    memberships,
    communications,
  }
}

const createInMemoryPrivacyService = (
  options: InMemoryPrivacyOptions = {}
): ResettablePrivacyService => {
  const now = options.now ?? (() => Date.now())
  const store = options.store ?? createInMemoryStore()

  const readRecentAttempts = (userId: string) => {
    const attempts = store.invalidOtpAttemptsByUserId.get(userId) ?? []
    const windowStart = now() - INVALID_OTP_WINDOW_MS
    const recentAttempts = attempts.filter((timestamp) => timestamp >= windowStart)
    store.invalidOtpAttemptsByUserId.set(userId, recentAttempts)
    return recentAttempts
  }

  const appendFailedAttempt = (userId: string) => {
    const recentAttempts = readRecentAttempts(userId)
    store.invalidOtpAttemptsByUserId.set(userId, [...recentAttempts, now()])
  }

  const validateOtp = (userId: string, otpCode: string) => {
    const recentAttempts = readRecentAttempts(userId)
    if (recentAttempts.length >= MAX_INVALID_OTP_ATTEMPTS) {
      throw new PrivacyServiceError('rate_limited', 'Too many attempts. Try again in a minute.')
    }

    if (otpCode.trim() !== DELETE_REAUTH_CODE) {
      appendFailedAttempt(userId)
      throw new PrivacyServiceError('invalid_reauth', 'Verification code is invalid.')
    }

    store.invalidOtpAttemptsByUserId.delete(userId)
  }

  const findLatestRequestByUserId = (userId: string) => {
    return store.deletionRequests
      .filter((request) => request.userId === userId)
      .sort((first, second) => second.requestedAt.localeCompare(first.requestedAt))[0]
  }

  return {
    async exportMyData(actor) {
      const actorUserId = assertAuthenticatedActor(actor)
      return buildExportBundle(actorUserId)
    },

    async requestMyDeletion(actor, input) {
      const actorUserId = assertAuthenticatedActor(actor)
      validateOtp(actorUserId, input.otpCode)

      const existing = findLatestRequestByUserId(actorUserId)
      if (existing && (existing.status === 'requested' || existing.status === 'processing')) {
        return existing
      }

      if (existing && existing.status === 'completed') {
        throw new PrivacyServiceError('already_deleted', 'This account has already been deleted.')
      }

      const created: DeletionRequestRecord = {
        id: createId(),
        userId: actorUserId,
        status: 'requested',
        requestedAt: nowIso(),
        completedAt: null,
      }

      store.deletionRequests.push(created)
      return created
    },

    async getMyDeletionRequest(actor) {
      const actorUserId = assertAuthenticatedActor(actor)
      return findLatestRequestByUserId(actorUserId) ?? null
    },

    async processDeletionRequest(actor, input) {
      assertCanProcessDeletion(actor)

      const request = store.deletionRequests.find((candidate) => candidate.id === input.requestId)
      if (!request) {
        throw new PrivacyServiceError('not_found', 'Deletion request not found.')
      }

      if (request.status === 'completed') {
        return request
      }

      if (request.status !== 'requested' && request.status !== 'processing') {
        throw new PrivacyServiceError('invalid_state', 'Deletion request is not in a processable state.')
      }

      request.status = 'processing'
      request.status = 'completed'
      request.completedAt = nowIso()
      markUserDeleted(request.userId)

      return request
    },

    resetForTests() {
      clearStore(store)
      resetDeletedUsersForTests()
    },
  }
}

const mapDeletionRow = (
  row: Record<string, unknown> | null | undefined
): DeletionRequestRecord | null => {
  if (!row) {
    return null
  }

  const id = String(row.id ?? '')
  const userId = String(row.user_id ?? '')

  if (!id || !userId) {
    return null
  }

  return {
    id,
    userId,
    status: String(row.status ?? 'requested') as DeletionRequestStatus,
    requestedAt: String(row.requested_at ?? nowIso()),
    completedAt: (row.completed_at as string | null) ?? null,
  }
}

const parseExportBundle = (raw: unknown, actorUserId: string): PrivacyExportBundle => {
  const fallback: PrivacyExportBundle = {
    generatedAt: nowIso(),
    profile: {
      userId: actorUserId,
      phoneE164: '',
      name: '',
      email: null,
    },
    interests: [],
    decisions: [],
    offers: [],
    memberships: [],
    communications: [],
  }

  if (!raw || typeof raw !== 'object') {
    return fallback
  }

  const payload = raw as Partial<PrivacyExportBundle>
  return {
    generatedAt: payload.generatedAt ?? fallback.generatedAt,
    profile: payload.profile ?? fallback.profile,
    interests: payload.interests ?? [],
    decisions: payload.decisions ?? [],
    offers: payload.offers ?? [],
    memberships: payload.memberships ?? [],
    communications: payload.communications ?? [],
  }
}

const createSupabasePrivacyService = (client: SupabaseClient): PrivacyService => ({
  async exportMyData(actor) {
    const actorUserId = assertAuthenticatedActor(actor)
    const { data, error } = await client.rpc('request_privacy_export')

    if (error) {
      throw new PrivacyServiceError(mapSupabaseErrorCode(error.message), error.message)
    }

    const payload = Array.isArray(data) ? data[0] : data
    return parseExportBundle(payload, actorUserId)
  },

  async requestMyDeletion(actor, input) {
    assertAuthenticatedActor(actor)

    const { data, error } = await client.rpc('request_account_deletion', {
      reauth_otp: input.otpCode,
    })

    if (error) {
      throw new PrivacyServiceError(mapSupabaseErrorCode(error.message), error.message)
    }

    const row = Array.isArray(data) ? data[0] : data
    const mapped = mapDeletionRow(row as Record<string, unknown> | null)

    if (!mapped) {
      throw new PrivacyServiceError('unknown', 'Unexpected response from deletion request endpoint.')
    }

    return mapped
  },

  async getMyDeletionRequest(actor) {
    const actorUserId = assertAuthenticatedActor(actor)
    const { data, error } = await client
      .from('deletion_requests')
      .select('id, user_id, status, requested_at, completed_at')
      .eq('user_id', actorUserId)
      .order('requested_at', { ascending: false })
      .maybeSingle()

    if (error) {
      throw new PrivacyServiceError(mapSupabaseErrorCode(error.message), error.message)
    }

    return mapDeletionRow(data as Record<string, unknown> | null)
  },

  async processDeletionRequest(actor, input) {
    assertCanProcessDeletion(actor)

    const { data, error } = await client.rpc('process_account_deletion', {
      target_request_id: input.requestId,
    })

    if (error) {
      throw new PrivacyServiceError(mapSupabaseErrorCode(error.message), error.message)
    }

    const row = Array.isArray(data) ? data[0] : data
    const mapped = mapDeletionRow(row as Record<string, unknown> | null)
    if (!mapped) {
      throw new PrivacyServiceError('unknown', 'Unexpected response from deletion processor.')
    }

    if (mapped.status === 'completed') {
      markUserDeleted(mapped.userId)
    }

    return mapped
  },
})

const sharedPrivacyService = useInMemoryPrivacy
  ? createInMemoryPrivacyService({ store: sharedInMemoryStore })
  : createSupabasePrivacyService(supabase)

export const resetPrivacyServiceForTests = () => {
  if (
    'resetForTests' in sharedPrivacyService &&
    typeof sharedPrivacyService.resetForTests === 'function'
  ) {
    sharedPrivacyService.resetForTests()
  } else {
    resetDeletedUsersForTests()
  }
}

export const privacyService: PrivacyService = {
  async exportMyData(actor) {
    try {
      return await sharedPrivacyService.exportMyData(actor)
    } catch (error) {
      throw mapUnknownToPrivacyError(error)
    }
  },

  async requestMyDeletion(actor, input) {
    try {
      return await sharedPrivacyService.requestMyDeletion(actor, input)
    } catch (error) {
      throw mapUnknownToPrivacyError(error)
    }
  },

  async getMyDeletionRequest(actor) {
    try {
      return await sharedPrivacyService.getMyDeletionRequest(actor)
    } catch (error) {
      throw mapUnknownToPrivacyError(error)
    }
  },

  async processDeletionRequest(actor, input) {
    try {
      return await sharedPrivacyService.processDeletionRequest(actor, input)
    } catch (error) {
      throw mapUnknownToPrivacyError(error)
    }
  },
}
