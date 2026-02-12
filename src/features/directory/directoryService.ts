import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/features/auth/session'
import { listProfilesForDirectory } from '@/features/auth/authService'
import { listInterestEntriesForDirectory } from '@/features/interest/interestService'
import { listMembershipsForDirectory } from '@/features/offers/offerService'
import { superAdminService } from '@/features/super-admin/superAdminService'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export interface DirectoryPersonRecord {
  userId: string
  universityId: string
  name: string
  avatarPath: string | null
  organizationIds: string[]
  organizationNames: string[]
  phoneE164: string | null
  email: string | null
}

interface DirectoryPersonPrivateRecord extends Omit<DirectoryPersonRecord, 'phoneE164' | 'email'> {
  phoneE164: string | null
  email: string | null
}

export interface SearchDirectoryPeopleParams {
  actorUserId: string | null
  actorRoles?: UserRole[]
  search?: string
  organizationId?: string | null
}

type DirectoryServiceErrorCode = 'unauthenticated' | 'forbidden' | 'unknown'

export class DirectoryServiceError extends Error {
  code: DirectoryServiceErrorCode

  constructor(code: DirectoryServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface DirectoryService {
  searchPeople: (params: SearchDirectoryPeopleParams) => Promise<DirectoryPersonRecord[]>
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryDirectory =
  import.meta.env.MODE === 'test' ||
  forceInMemoryFromSession ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const normalizeSearch = (value?: string) => {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

const mapUnknownToDirectoryServiceError = (error: unknown): DirectoryServiceError => {
  if (error instanceof DirectoryServiceError) {
    return error
  }

  return new DirectoryServiceError('unknown', 'Something went wrong. Please try again.')
}

const mapSupabaseMessageToErrorCode = (message: string): DirectoryServiceErrorCode => {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalizedMessage.includes('forbidden') || normalizedMessage.includes('permission')) {
    return 'forbidden'
  }

  return 'unknown'
}

const mapDirectoryRow = (
  row: Record<string, unknown> | null | undefined
): DirectoryPersonRecord => {
  const organizationIds = Array.isArray(row?.organization_ids)
    ? (row?.organization_ids as unknown[])
        .map((value) => String(value))
        .filter((value) => value.length > 0)
    : []
  const organizationNames = Array.isArray(row?.organization_names)
    ? (row?.organization_names as unknown[])
        .map((value) => String(value))
        .filter((value) => value.length > 0)
    : []

  return {
    userId: String(row?.user_id ?? ''),
    universityId: String(row?.university_id ?? ''),
    name: String(row?.name ?? ''),
    avatarPath: (row?.avatar_path as string | null) ?? null,
    organizationIds,
    organizationNames,
    phoneE164: (row?.phone_e164 as string | null) ?? null,
    email: (row?.email as string | null) ?? null,
  }
}

const createInMemoryDirectoryService = (): DirectoryService => ({
  async searchPeople({ actorUserId, actorRoles = [], search, organizationId }) {
    if (!actorUserId) {
      throw new DirectoryServiceError('unauthenticated', 'Authentication is required.')
    }

    const isSuperAdmin = actorRoles.includes('super_admin')
    const normalizedSearch = normalizeSearch(search)
    const organizations = await superAdminService.listOrganizations({
      actorUserId: 'directory-system',
      actorRoles: ['super_admin'],
    })

    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization])
    )

    const profileRecords = await listProfilesForDirectory()
    const profileByUserId = new Map(profileRecords.map((profile) => [profile.userId, profile]))
    const memberships = await listMembershipsForDirectory()
    const interests = await listInterestEntriesForDirectory()
    const activeMemberships = memberships.filter((membership) => membership.status === 'active')
    const membershipsByUserId = new Map<string, string[]>()
    const interestsByUserId = new Map<string, string[]>()

    for (const membership of activeMemberships) {
      const existing = membershipsByUserId.get(membership.userId) ?? []
      existing.push(membership.organizationId)
      membershipsByUserId.set(membership.userId, existing)
    }

    for (const interest of interests) {
      const existing = interestsByUserId.get(interest.userId) ?? []
      existing.push(interest.organizationId)
      interestsByUserId.set(interest.userId, existing)
    }

    const candidateUserIds = new Set(profileRecords.map((profile) => profile.userId))
    for (const membership of activeMemberships) {
      candidateUserIds.add(membership.userId)
    }
    for (const interest of interests) {
      candidateUserIds.add(interest.userId)
    }
    candidateUserIds.add(actorUserId)

    const privateRecords: DirectoryPersonPrivateRecord[] = []

    for (const userId of candidateUserIds) {
      const organizationIds = [...new Set(membershipsByUserId.get(userId) ?? [])]
      const organizationNames = organizationIds
        .map((id) => organizationById.get(id)?.name ?? null)
        .filter(Boolean) as string[]

      const inferredUniversityFromMembership = organizationIds
        .map((id) => organizationById.get(id)?.universityId ?? null)
        .find(Boolean)

      const inferredUniversityFromInterest = (interestsByUserId.get(userId) ?? [])
        .map((id) => organizationById.get(id)?.universityId ?? null)
        .find(Boolean)

      const universityId =
        inferredUniversityFromMembership ??
        inferredUniversityFromInterest ??
        null

      if (!universityId) {
        continue
      }

      const profile = profileByUserId.get(userId)

      privateRecords.push({
        userId,
        universityId,
        name: profile?.name?.trim() ? profile.name : userId,
        avatarPath: null,
        organizationIds,
        organizationNames,
        phoneE164: profile?.phoneE164 ?? null,
        email: profile?.email ?? null,
      })
    }

    const actorRecord = privateRecords.find((record) => record.userId === actorUserId)
    if (!actorRecord && !isSuperAdmin) {
      return []
    }

    const actorUniversityId = actorRecord?.universityId ?? null
    const actorOrganizationIds = new Set(actorRecord?.organizationIds ?? [])

    return privateRecords
      .filter((record) => isSuperAdmin || record.universityId === actorUniversityId)
      .filter((record) => !organizationId || record.organizationIds.includes(organizationId))
      .filter((record) => {
        if (!normalizedSearch) {
          return true
        }

        if (record.name.toLowerCase().includes(normalizedSearch)) {
          return true
        }

        return record.organizationNames.some((name) =>
          name.toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((record) => {
        const canViewPrivate =
          isSuperAdmin ||
          record.userId === actorUserId ||
          record.organizationIds.some((id) => actorOrganizationIds.has(id))

        return {
          ...record,
          phoneE164: canViewPrivate ? record.phoneE164 : null,
          email: canViewPrivate ? record.email : null,
        }
      })
  },
})

const createSupabaseDirectoryService = (client: SupabaseClient): DirectoryService => ({
  async searchPeople({ actorUserId, search, organizationId }) {
    if (!actorUserId) {
      throw new DirectoryServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await client.rpc('search_directory_people', {
      lookup_search: normalizeSearch(search),
      filter_organization_id: organizationId ?? null,
    })

    if (error) {
      throw new DirectoryServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const rows = Array.isArray(data) ? data : [data]
    return rows.map((row) => mapDirectoryRow(row as Record<string, unknown> | null))
  },
})

const sharedDirectoryService = useInMemoryDirectory
  ? createInMemoryDirectoryService()
  : createSupabaseDirectoryService(supabase)

export const resetDirectoryServiceForTests = () => {}

export const directoryService: DirectoryService = {
  async searchPeople(params) {
    try {
      return await sharedDirectoryService.searchPeople(params)
    } catch (error) {
      throw mapUnknownToDirectoryServiceError(error)
    }
  },
}
