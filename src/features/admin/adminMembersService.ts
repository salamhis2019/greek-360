import type { UserRole } from '@/features/auth/session'
import { directoryService } from '@/features/directory/directoryService'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export interface OrganizationMemberRecord {
  userId: string
  name: string
  phoneE164: string | null
  email: string | null
}

export type AdminMembersServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'unknown'

export class AdminMembersServiceError extends Error {
  code: AdminMembersServiceErrorCode

  constructor(code: AdminMembersServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface AdminMembersActor {
  actorUserId: string | null
  actorRoles: UserRole[]
}

interface AdminMembersService {
  listMembers: (
    actor: AdminMembersActor,
    organizationId: string
  ) => Promise<OrganizationMemberRecord[]>
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryAdminMembers =
  import.meta.env.MODE === 'test' ||
  forceInMemoryFromSession ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const mapUnknownToAdminMembersServiceError = (error: unknown): AdminMembersServiceError => {
  if (error instanceof AdminMembersServiceError) {
    return error
  }

  return new AdminMembersServiceError('unknown', 'Something went wrong. Please try again.')
}

const assertAuthorized = (actor: AdminMembersActor) => {
  if (!actor.actorUserId) {
    throw new AdminMembersServiceError('unauthenticated', 'Authentication is required.')
  }

  if (!actor.actorRoles.includes('chapter_admin') && !actor.actorRoles.includes('super_admin')) {
    throw new AdminMembersServiceError('forbidden', 'Chapter-admin or super-admin access is required.')
  }
}

const createInMemoryAdminMembersService = (): AdminMembersService => ({
  async listMembers(actor, organizationId) {
    assertAuthorized(actor)

    if (!organizationId) {
      throw new AdminMembersServiceError('invalid_input', 'Organization id is required.')
    }

    const records = await directoryService.searchPeople({
      actorUserId: actor.actorUserId,
      actorRoles: actor.actorRoles,
      organizationId,
    })

    return records.map((record) => ({
      userId: record.userId,
      name: record.name,
      phoneE164: record.phoneE164,
      email: record.email,
    }))
  },
})

const mapSupabaseMessageToErrorCode = (message: string): AdminMembersServiceErrorCode => {
  const normalized = message.toLowerCase()

  if (normalized.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalized.includes('forbidden')) {
    return 'forbidden'
  }

  if (normalized.includes('organization')) {
    return 'invalid_input'
  }

  return 'unknown'
}

const createSupabaseAdminMembersService = (): AdminMembersService => ({
  async listMembers(actor, organizationId) {
    assertAuthorized(actor)

    if (!organizationId) {
      throw new AdminMembersServiceError('invalid_input', 'Organization id is required.')
    }

    const { data, error } = await supabase.rpc('list_organization_members', {
      target_organization_id: organizationId,
    })

    if (error) {
      throw new AdminMembersServiceError(
        mapSupabaseMessageToErrorCode(error.message),
        error.message
      )
    }

    const rows = Array.isArray(data) ? data : [data]

    return rows
      .filter(Boolean)
      .map((row) => {
        const typedRow = row as Record<string, unknown>

        return {
          userId: String(typedRow.user_id ?? ''),
          name: String(typedRow.name ?? ''),
          phoneE164: (typedRow.phone_e164 as string | null) ?? null,
          email: (typedRow.email as string | null) ?? null,
        } satisfies OrganizationMemberRecord
      })
      .filter((row) => row.userId.length > 0)
  },
})

const sharedAdminMembersService = useInMemoryAdminMembers
  ? createInMemoryAdminMembersService()
  : createSupabaseAdminMembersService()

export const adminMembersService: AdminMembersService = {
  async listMembers(actor, organizationId) {
    try {
      return await sharedAdminMembersService.listMembers(actor, organizationId)
    } catch (error) {
      throw mapUnknownToAdminMembersServiceError(error)
    }
  },
}
