import type { SupabaseClient } from '@supabase/supabase-js'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type MembershipStatus = 'active' | 'inactive'
export type OfferResponseValue = 'accept' | 'decline'

export interface OfferRecord {
  id: string
  interestEntryId: string
  userId: string
  organizationId: string
  organizationName: string | null
  cycleId: string
  cycleTerm: string | null
  cycleYear: number | null
  status: OfferStatus
  offeredAt: string
  respondedAt: string | null
}

export interface MembershipRecord {
  id: string
  userId: string
  organizationId: string
  organizationName: string | null
  status: MembershipStatus
  joinedAt: string
  endedAt: string | null
}

export interface OfferResponseResult {
  offer: OfferRecord
  membership: MembershipRecord | null
}

interface EnsurePendingOfferParams {
  interestEntryId: string
  userId: string
  organizationId: string
  cycleId: string
}

interface RespondToOfferParams {
  actorUserId: string | null
  offerId: string
  response: OfferResponseValue
}

export type OfferServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_response'
  | 'invalid_transition'
  | 'membership_conflict'
  | 'unknown'

export class OfferServiceError extends Error {
  code: OfferServiceErrorCode

  constructor(code: OfferServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface OfferService {
  listOffersForStudent: (actorUserId: string | null) => Promise<OfferRecord[]>
  respondToOffer: (params: RespondToOfferParams) => Promise<OfferResponseResult>
  listMembershipsForUser: (actorUserId: string | null) => Promise<MembershipRecord[]>
  ensurePendingOfferForFinalYes: (params: EnsurePendingOfferParams) => Promise<OfferRecord>
}

interface ResettableOfferService extends OfferService {
  resetForTests: () => void
  listAllMembershipsForDirectory?: () => Promise<MembershipRecord[]>
  listAllOffersForMessaging?: () => Promise<OfferRecord[]>
}

interface InMemoryOfferStore {
  offers: OfferRecord[]
  memberships: MembershipRecord[]
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryOffers =
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

const createInMemoryStore = (): InMemoryOfferStore => ({
  offers: [],
  memberships: [],
})

const sharedInMemoryStore = createInMemoryStore()

const clearStore = (store: InMemoryOfferStore) => {
  store.offers.length = 0
  store.memberships.length = 0
}

const mapUnknownToOfferServiceError = (error: unknown): OfferServiceError => {
  if (error instanceof OfferServiceError) {
    return error
  }

  return new OfferServiceError('unknown', 'Something went wrong. Please try again.')
}

const normalizeResponseOrThrow = (value: OfferResponseValue) => {
  if (value !== 'accept' && value !== 'decline') {
    throw new OfferServiceError('invalid_response', 'Offer response must be accept or decline.')
  }

  return value
}

const mapSupabaseMessageToErrorCode = (message: string): OfferServiceErrorCode => {
  const normalized = message.toLowerCase()

  if (normalized.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalized.includes('forbidden')) {
    return 'forbidden'
  }

  if (normalized.includes('not found')) {
    return 'not_found'
  }

  if (normalized.includes('active membership already exists')) {
    return 'membership_conflict'
  }

  if (normalized.includes('response')) {
    return 'invalid_response'
  }

  if (normalized.includes('not pending') || normalized.includes('already')) {
    return 'invalid_transition'
  }

  return 'unknown'
}

const readForcedFailureMessage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const message = window.sessionStorage.getItem('greek360.test.failNextOfferResponse')
  if (!message) {
    return null
  }

  window.sessionStorage.removeItem('greek360.test.failNextOfferResponse')
  return message
}

const createInMemoryOfferService = (
  options: {
    store?: InMemoryOfferStore
  } = {}
): ResettableOfferService => {
  const store = options.store ?? createInMemoryStore()

  return {
    async listOffersForStudent(actorUserId) {
      if (!actorUserId) {
        throw new OfferServiceError('unauthenticated', 'Authentication is required.')
      }

      return store.offers
        .filter((offer) => offer.userId === actorUserId)
        .sort((first, second) => second.offeredAt.localeCompare(first.offeredAt))
    },

    async respondToOffer({ actorUserId, offerId, response }) {
      const forcedFailureMessage = readForcedFailureMessage()
      if (forcedFailureMessage) {
        throw new OfferServiceError('unknown', forcedFailureMessage)
      }

      if (!actorUserId) {
        throw new OfferServiceError('unauthenticated', 'Authentication is required.')
      }

      const normalizedResponse = normalizeResponseOrThrow(response)
      const offer = store.offers.find((item) => item.id === offerId)

      if (!offer) {
        throw new OfferServiceError('not_found', 'Offer not found.')
      }

      if (offer.userId !== actorUserId) {
        throw new OfferServiceError('forbidden', 'You are not allowed to respond to this offer.')
      }

      if (normalizedResponse === 'decline') {
        if (offer.status === 'declined') {
          return {
            offer,
            membership: null,
          }
        }

        if (offer.status !== 'pending') {
          throw new OfferServiceError(
            'invalid_transition',
            'This offer is no longer pending and cannot be declined.'
          )
        }

        offer.status = 'declined'
        offer.respondedAt = nowIso()

        return {
          offer,
          membership: null,
        }
      }

      const existingMembership = store.memberships.find(
        (membership) => membership.userId === actorUserId && membership.status === 'active'
      )

      if (offer.status === 'accepted') {
        const acceptedMembership =
          store.memberships.find(
            (membership) =>
              membership.userId === actorUserId &&
              membership.organizationId === offer.organizationId &&
              membership.status === 'active'
          ) ?? existingMembership ?? null

        return {
          offer,
          membership: acceptedMembership,
        }
      }

      if (offer.status !== 'pending') {
        throw new OfferServiceError(
          'invalid_transition',
          'This offer is no longer pending and cannot be accepted.'
        )
      }

      if (existingMembership) {
        throw new OfferServiceError(
          'membership_conflict',
          'An active membership already exists for this user.'
        )
      }

      offer.status = 'accepted'
      offer.respondedAt = nowIso()

      const membership: MembershipRecord = {
        id: createId(),
        userId: actorUserId,
        organizationId: offer.organizationId,
        organizationName: offer.organizationName,
        status: 'active',
        joinedAt: nowIso(),
        endedAt: null,
      }

      store.memberships.push(membership)

      for (const candidate of store.offers) {
        if (candidate.id === offer.id || candidate.userId !== actorUserId) {
          continue
        }

        if (candidate.status === 'pending') {
          candidate.status = 'expired'
          candidate.respondedAt = nowIso()
        }
      }

      return {
        offer,
        membership,
      }
    },

    async listMembershipsForUser(actorUserId) {
      if (!actorUserId) {
        throw new OfferServiceError('unauthenticated', 'Authentication is required.')
      }

      return store.memberships
        .filter((membership) => membership.userId === actorUserId)
        .sort((first, second) => second.joinedAt.localeCompare(first.joinedAt))
    },

    async listAllMembershipsForDirectory() {
      return [...store.memberships]
    },

    async listAllOffersForMessaging() {
      return [...store.offers]
    },

    async ensurePendingOfferForFinalYes({
      interestEntryId,
      userId,
      organizationId,
      cycleId,
    }: EnsurePendingOfferParams) {
      const existing = store.offers.find((offer) => offer.interestEntryId === interestEntryId)
      if (existing) {
        return existing
      }

      const created: OfferRecord = {
        id: createId(),
        interestEntryId,
        userId,
        organizationId,
        organizationName: null,
        cycleId,
        cycleTerm: null,
        cycleYear: null,
        status: 'pending',
        offeredAt: nowIso(),
        respondedAt: null,
      }

      store.offers.push(created)
      return created
    },

    resetForTests() {
      clearStore(store)
    },
  }
}

const mapOfferRow = (row: Record<string, unknown> | null | undefined): OfferRecord => {
  return {
    id: String(row?.offer_id ?? row?.id ?? ''),
    interestEntryId: String(row?.interest_entry_id ?? ''),
    userId: String(row?.user_id ?? ''),
    organizationId: String(row?.organization_id ?? ''),
    organizationName: (row?.organization_name as string | null) ?? null,
    cycleId: String(row?.cycle_id ?? ''),
    cycleTerm: (row?.cycle_term as string | null) ?? null,
    cycleYear:
      typeof row?.cycle_year === 'number'
        ? row.cycle_year
        : row?.cycle_year
          ? Number(row.cycle_year)
          : null,
    status: String(row?.offer_status ?? row?.status ?? 'pending') as OfferStatus,
    offeredAt: String(row?.offered_at ?? nowIso()),
    respondedAt: (row?.responded_at as string | null) ?? null,
  }
}

const mapMembershipRow = (
  row: Record<string, unknown> | null | undefined
): MembershipRecord | null => {
  const membershipId = String(row?.membership_id ?? row?.id ?? '')
  if (!membershipId) {
    return null
  }

  return {
    id: membershipId,
    userId: String(row?.user_id ?? ''),
    organizationId: String(row?.organization_id ?? ''),
    organizationName: (row?.organization_name as string | null) ?? null,
    status: String(row?.membership_status ?? row?.status ?? 'active') as MembershipStatus,
    joinedAt: String(row?.membership_joined_at ?? row?.joined_at ?? nowIso()),
    endedAt:
      (row?.membership_ended_at as string | null) ?? (row?.ended_at as string | null) ?? null,
  }
}

const createSupabaseOfferService = (client: SupabaseClient): OfferService => ({
  async listOffersForStudent(actorUserId) {
    if (!actorUserId) {
      throw new OfferServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('list_my_offers')
    if (error) {
      throw new OfferServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const rows = Array.isArray(data) ? data : [data]
    return rows.map((row) => mapOfferRow(row as Record<string, unknown> | null))
  },

  async respondToOffer({ actorUserId, offerId, response }) {
    if (!actorUserId) {
      throw new OfferServiceError('unauthenticated', 'Authentication is required.')
    }

    const normalizedResponse = normalizeResponseOrThrow(response)
    const { data, error } = await client.rpc('respond_to_offer', {
      target_offer_id: offerId,
      offer_response: normalizedResponse,
    })

    if (error) {
      throw new OfferServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
    return {
      offer: mapOfferRow(row),
      membership: mapMembershipRow(row),
    }
  },

  async listMembershipsForUser(actorUserId) {
    if (!actorUserId) {
      throw new OfferServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('list_my_memberships')
    if (error) {
      throw new OfferServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const rows = Array.isArray(data) ? data : [data]
    return rows
      .map((row) => mapMembershipRow(row as Record<string, unknown> | null))
      .filter(Boolean) as MembershipRecord[]
  },

  async ensurePendingOfferForFinalYes({
    interestEntryId,
    userId,
    organizationId,
    cycleId,
  }: EnsurePendingOfferParams) {
    const { data, error } = await client.rpc('create_offer_for_final_yes', {
      target_interest_entry_id: interestEntryId,
    })

    if (error) {
      throw new OfferServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
    if (!row) {
      return {
        id: '',
        interestEntryId,
        userId,
        organizationId,
        organizationName: null,
        cycleId,
        cycleTerm: null,
        cycleYear: null,
        status: 'pending',
        offeredAt: nowIso(),
        respondedAt: null,
      }
    }

    const mapped = mapOfferRow(row)
    return {
      ...mapped,
      userId: mapped.userId || userId,
      organizationId: mapped.organizationId || organizationId,
      cycleId: mapped.cycleId || cycleId,
    }
  },
})

const sharedOfferService = useInMemoryOffers
  ? createInMemoryOfferService({ store: sharedInMemoryStore })
  : createSupabaseOfferService(supabase)

export const resetOfferServiceForTests = () => {
  if ('resetForTests' in sharedOfferService && typeof sharedOfferService.resetForTests === 'function') {
    sharedOfferService.resetForTests()
  }
}

export const listMembershipsForDirectory = async (): Promise<MembershipRecord[]> => {
  if (
    'listAllMembershipsForDirectory' in sharedOfferService &&
    typeof sharedOfferService.listAllMembershipsForDirectory === 'function'
  ) {
    return sharedOfferService.listAllMembershipsForDirectory()
  }

  return []
}

export const listOffersForMessaging = async (): Promise<OfferRecord[]> => {
  if (
    'listAllOffersForMessaging' in sharedOfferService &&
    typeof sharedOfferService.listAllOffersForMessaging === 'function'
  ) {
    return sharedOfferService.listAllOffersForMessaging()
  }

  return []
}

export const offerService: OfferService = {
  async listOffersForStudent(actorUserId) {
    try {
      return await sharedOfferService.listOffersForStudent(actorUserId)
    } catch (error) {
      throw mapUnknownToOfferServiceError(error)
    }
  },

  async respondToOffer(params) {
    try {
      return await sharedOfferService.respondToOffer(params)
    } catch (error) {
      throw mapUnknownToOfferServiceError(error)
    }
  },

  async listMembershipsForUser(actorUserId) {
    try {
      return await sharedOfferService.listMembershipsForUser(actorUserId)
    } catch (error) {
      throw mapUnknownToOfferServiceError(error)
    }
  },

  async ensurePendingOfferForFinalYes(params) {
    try {
      return await sharedOfferService.ensurePendingOfferForFinalYes(params)
    } catch (error) {
      throw mapUnknownToOfferServiceError(error)
    }
  },
}
