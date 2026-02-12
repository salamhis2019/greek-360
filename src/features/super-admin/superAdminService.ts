import type { SupabaseClient } from '@supabase/supabase-js'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'
import type { UserRole } from '@/features/auth/session'

export type UniversityStatus = 'active' | 'inactive'
export type OrganizationType = 'fraternity' | 'sorority'
export type OrganizationStatus = 'active' | 'inactive'
export type RecruitmentCycleStatus = 'draft' | 'active' | 'closed'

export interface SuperAdminActor {
  actorUserId: string | null
  actorRoles: UserRole[]
}

export interface UniversityRecord {
  id: string
  name: string
  slug: string
  status: UniversityStatus
  createdAt: string
}

export interface OrganizationRecord {
  id: string
  universityId: string
  name: string
  slug: string
  type: OrganizationType
  status: OrganizationStatus
  createdAt: string
}

export interface RecruitmentCycleRecord {
  id: string
  organizationId: string
  term: string
  year: number
  status: RecruitmentCycleStatus
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

export interface JoinLinkRecord {
  id: string
  organizationId: string
  cycleId: string
  code: string
  isActive: boolean
  createdAt: string
}

export interface OrganizationAdminRecord {
  organizationId: string
  userId: string
  createdAt: string
}

export interface CreateUniversityInput {
  name: string
  slug: string
  status: UniversityStatus
}

export interface CreateOrganizationInput {
  universityId: string
  name: string
  slug: string
  type: OrganizationType | string
  status: OrganizationStatus
}

export interface CreateRecruitmentCycleInput {
  organizationId: string
  term: string
  year: number
  status: RecruitmentCycleStatus
  startsAt?: string | null
  endsAt?: string | null
}

export interface CreateJoinLinkInput {
  organizationId: string
  cycleId: string
  code: string
  isActive?: boolean
}

export interface AssignOrganizationAdminInput {
  organizationId: string
  userId: string
}

export interface RevokeOrganizationAdminInput {
  organizationId: string
  userId: string
}

export type SuperAdminServiceErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'conflict'
  | 'not_found'
  | 'unknown'

export class SuperAdminServiceError extends Error {
  code: SuperAdminServiceErrorCode

  constructor(code: SuperAdminServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface SuperAdminService {
  listUniversities: (actor: SuperAdminActor) => Promise<UniversityRecord[]>
  createUniversity: (
    actor: SuperAdminActor,
    input: CreateUniversityInput
  ) => Promise<UniversityRecord>
  listOrganizations: (actor: SuperAdminActor) => Promise<OrganizationRecord[]>
  createOrganization: (
    actor: SuperAdminActor,
    input: CreateOrganizationInput
  ) => Promise<OrganizationRecord>
  listRecruitmentCycles: (actor: SuperAdminActor) => Promise<RecruitmentCycleRecord[]>
  createRecruitmentCycle: (
    actor: SuperAdminActor,
    input: CreateRecruitmentCycleInput
  ) => Promise<RecruitmentCycleRecord>
  listJoinLinks: (actor: SuperAdminActor) => Promise<JoinLinkRecord[]>
  createJoinLink: (actor: SuperAdminActor, input: CreateJoinLinkInput) => Promise<JoinLinkRecord>
  listOrganizationAdmins: (actor: SuperAdminActor) => Promise<OrganizationAdminRecord[]>
  assignOrganizationAdmin: (
    actor: SuperAdminActor,
    input: AssignOrganizationAdminInput
  ) => Promise<OrganizationAdminRecord>
  revokeOrganizationAdmin: (
    actor: SuperAdminActor,
    input: RevokeOrganizationAdminInput
  ) => Promise<boolean>
}

interface InMemorySuperAdminStore {
  universities: UniversityRecord[]
  organizations: OrganizationRecord[]
  recruitmentCycles: RecruitmentCycleRecord[]
  joinLinks: JoinLinkRecord[]
  organizationAdmins: OrganizationAdminRecord[]
}

interface InMemorySuperAdminOptions {
  store?: InMemorySuperAdminStore
}

const useInMemorySuperAdmin =
  import.meta.env.MODE === 'test' ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const termPattern = /^[a-z][a-z0-9_-]{1,31}$/
const joinCodePattern = /^[A-Z0-9]{6,12}$/

const createInMemoryStore = (): InMemorySuperAdminStore => ({
  universities: [],
  organizations: [],
  recruitmentCycles: [],
  joinLinks: [],
  organizationAdmins: [],
})

const clearStore = (store: InMemorySuperAdminStore) => {
  store.universities.length = 0
  store.organizations.length = 0
  store.recruitmentCycles.length = 0
  store.joinLinks.length = 0
  store.organizationAdmins.length = 0
}

const sharedInMemoryStore = createInMemoryStore()

const buildFallbackId = () => `local-${Math.random().toString(36).slice(2, 12)}`

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return buildFallbackId()
}

const nowIso = () => new Date().toISOString()

const requireSuperAdminActor = (actor: SuperAdminActor) => {
  if (!actor.actorRoles.includes('super_admin')) {
    throw new SuperAdminServiceError('forbidden', 'Super-admin access is required.')
  }
}

const mapSupabaseMessageToErrorCode = (message: string): SuperAdminServiceErrorCode => {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('forbidden') || normalizedMessage.includes('permission')) {
    return 'forbidden'
  }

  if (normalizedMessage.includes('duplicate') || normalizedMessage.includes('unique')) {
    return 'conflict'
  }

  if (normalizedMessage.includes('not found')) {
    return 'not_found'
  }

  if (
    normalizedMessage.includes('invalid') ||
    normalizedMessage.includes('required') ||
    normalizedMessage.includes('must be')
  ) {
    return 'invalid_input'
  }

  return 'unknown'
}

const mapUnknownErrorToSuperAdminServiceError = (error: unknown): SuperAdminServiceError => {
  if (error instanceof SuperAdminServiceError) {
    return error
  }

  return new SuperAdminServiceError('unknown', 'Something went wrong. Please try again.')
}

const normalizeSlug = (value: string) => value.trim().toLowerCase()
const normalizeTerm = (value: string) => value.trim().toLowerCase()
const normalizeJoinCode = (value: string) => value.trim().toUpperCase()

export const createInMemorySuperAdminService = (
  options: InMemorySuperAdminOptions = {}
): SuperAdminService => {
  const store = options.store ?? createInMemoryStore()

  const validateUniversityInput = ({ name, slug }: CreateUniversityInput) => {
    const normalizedName = name.trim()
    const normalizedSlug = normalizeSlug(slug)

    if (normalizedName.length < 2) {
      throw new SuperAdminServiceError(
        'invalid_input',
        'University name must be at least 2 characters.'
      )
    }

    if (!slugPattern.test(normalizedSlug)) {
      throw new SuperAdminServiceError(
        'invalid_input',
        'University slug must use lowercase letters, numbers, and hyphens.'
      )
    }

    if (store.universities.some((item) => item.slug === normalizedSlug)) {
      throw new SuperAdminServiceError('conflict', 'University slug already exists.')
    }
  }

  const validateOrganizationInput = ({
    universityId,
    name,
    slug,
    type,
  }: CreateOrganizationInput) => {
    const normalizedName = name.trim()
    const normalizedSlug = normalizeSlug(slug)
    const normalizedType = type.trim().toLowerCase()

    if (!store.universities.some((item) => item.id === universityId)) {
      throw new SuperAdminServiceError('not_found', 'University not found.')
    }

    if (normalizedName.length < 2) {
      throw new SuperAdminServiceError(
        'invalid_input',
        'Organization name must be at least 2 characters.'
      )
    }

    if (!slugPattern.test(normalizedSlug)) {
      throw new SuperAdminServiceError(
        'invalid_input',
        'Organization slug must use lowercase letters, numbers, and hyphens.'
      )
    }

    if (normalizedType !== 'fraternity' && normalizedType !== 'sorority') {
      throw new SuperAdminServiceError('invalid_input', 'Organization type must be valid.')
    }

    if (
      store.organizations.some(
        (item) => item.universityId === universityId && item.slug === normalizedSlug
      )
    ) {
      throw new SuperAdminServiceError('conflict', 'Organization slug already exists.')
    }
  }

  const validateRecruitmentCycleInput = ({
    organizationId,
    term,
    year,
  }: CreateRecruitmentCycleInput) => {
    const normalizedTerm = normalizeTerm(term)

    if (!store.organizations.some((item) => item.id === organizationId)) {
      throw new SuperAdminServiceError('not_found', 'Organization not found.')
    }

    if (!termPattern.test(normalizedTerm)) {
      throw new SuperAdminServiceError(
        'invalid_input',
        'Recruitment term must use lowercase letters, numbers, underscores, or hyphens.'
      )
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new SuperAdminServiceError('invalid_input', 'Recruitment cycle year is invalid.')
    }

    if (
      store.recruitmentCycles.some(
        (item) =>
          item.organizationId === organizationId &&
          item.term === normalizedTerm &&
          item.year === year
      )
    ) {
      throw new SuperAdminServiceError('conflict', 'Recruitment cycle already exists.')
    }
  }

  const validateJoinLinkInput = ({ organizationId, cycleId, code }: CreateJoinLinkInput) => {
    const normalizedCode = normalizeJoinCode(code)
    const matchedCycle = store.recruitmentCycles.find(
      (item) => item.id === cycleId && item.organizationId === organizationId
    )

    if (!matchedCycle) {
      throw new SuperAdminServiceError(
        'not_found',
        'Recruitment cycle for this organization was not found.'
      )
    }

    if (!joinCodePattern.test(normalizedCode)) {
      throw new SuperAdminServiceError(
        'invalid_input',
        'Join code must be 6-12 uppercase letters or numbers.'
      )
    }

    if (
      store.joinLinks.some(
        (item) => item.organizationId === organizationId && item.cycleId === cycleId
      )
    ) {
      throw new SuperAdminServiceError(
        'conflict',
        'A static join code already exists for this organization and cycle.'
      )
    }

    if (store.joinLinks.some((item) => item.code === normalizedCode)) {
      throw new SuperAdminServiceError('conflict', 'Join code already exists.')
    }
  }

  const validateAdminAssignmentInput = ({
    organizationId,
    userId,
  }: AssignOrganizationAdminInput) => {
    if (!store.organizations.some((item) => item.id === organizationId)) {
      throw new SuperAdminServiceError('not_found', 'Organization not found.')
    }

    if (userId.trim().length < 3) {
      throw new SuperAdminServiceError('invalid_input', 'Admin user id is required.')
    }

    if (
      store.organizationAdmins.some(
        (item) => item.organizationId === organizationId && item.userId === userId.trim()
      )
    ) {
      throw new SuperAdminServiceError('conflict', 'Admin assignment already exists.')
    }
  }

  return {
    async listUniversities(actor) {
      requireSuperAdminActor(actor)
      return [...store.universities]
    },

    async createUniversity(actor, input) {
      requireSuperAdminActor(actor)
      validateUniversityInput(input)

      const createdRecord: UniversityRecord = {
        id: createId(),
        name: input.name.trim(),
        slug: normalizeSlug(input.slug),
        status: input.status,
        createdAt: nowIso(),
      }

      store.universities.push(createdRecord)
      return createdRecord
    },

    async listOrganizations(actor) {
      requireSuperAdminActor(actor)
      return [...store.organizations]
    },

    async createOrganization(actor, input) {
      requireSuperAdminActor(actor)
      validateOrganizationInput(input)

      const createdRecord: OrganizationRecord = {
        id: createId(),
        universityId: input.universityId,
        name: input.name.trim(),
        slug: normalizeSlug(input.slug),
        type: input.type.trim().toLowerCase() as OrganizationType,
        status: input.status,
        createdAt: nowIso(),
      }

      store.organizations.push(createdRecord)
      return createdRecord
    },

    async listRecruitmentCycles(actor) {
      requireSuperAdminActor(actor)
      return [...store.recruitmentCycles]
    },

    async createRecruitmentCycle(actor, input) {
      requireSuperAdminActor(actor)
      validateRecruitmentCycleInput(input)

      const createdRecord: RecruitmentCycleRecord = {
        id: createId(),
        organizationId: input.organizationId,
        term: normalizeTerm(input.term),
        year: input.year,
        status: input.status,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdAt: nowIso(),
      }

      store.recruitmentCycles.push(createdRecord)
      return createdRecord
    },

    async listJoinLinks(actor) {
      requireSuperAdminActor(actor)
      return [...store.joinLinks]
    },

    async createJoinLink(actor, input) {
      requireSuperAdminActor(actor)
      validateJoinLinkInput(input)

      const createdRecord: JoinLinkRecord = {
        id: createId(),
        organizationId: input.organizationId,
        cycleId: input.cycleId,
        code: normalizeJoinCode(input.code),
        isActive: input.isActive ?? true,
        createdAt: nowIso(),
      }

      store.joinLinks.push(createdRecord)
      return createdRecord
    },

    async listOrganizationAdmins(actor) {
      requireSuperAdminActor(actor)
      return [...store.organizationAdmins]
    },

    async assignOrganizationAdmin(actor, input) {
      requireSuperAdminActor(actor)
      validateAdminAssignmentInput(input)

      const createdRecord: OrganizationAdminRecord = {
        organizationId: input.organizationId,
        userId: input.userId.trim(),
        createdAt: nowIso(),
      }

      store.organizationAdmins.push(createdRecord)
      return createdRecord
    },

    async revokeOrganizationAdmin(actor, input) {
      requireSuperAdminActor(actor)

      const assignmentIndex = store.organizationAdmins.findIndex(
        (item) =>
          item.organizationId === input.organizationId && item.userId === input.userId.trim()
      )

      if (assignmentIndex < 0) {
        return false
      }

      store.organizationAdmins.splice(assignmentIndex, 1)
      return true
    },
  }
}

const createSupabaseSuperAdminService = (client: SupabaseClient): SuperAdminService => ({
  async listUniversities(actor) {
    requireSuperAdminActor(actor)

    const { data, error } = await client
      .from('universities')
      .select('id, name, slug, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      name: item.name as string,
      slug: item.slug as string,
      status: item.status as UniversityStatus,
      createdAt: item.created_at as string,
    }))
  },

  async createUniversity(actor, input) {
    requireSuperAdminActor(actor)

    const { data, error } = await client.rpc('create_university', {
      university_name: input.name.trim(),
      university_slug: normalizeSlug(input.slug),
      university_status: input.status,
    })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const record = data as {
      id?: string
      name?: string
      slug?: string
      status?: UniversityStatus
      created_at?: string
    }

    return {
      id: record.id ?? '',
      name: record.name ?? input.name.trim(),
      slug: record.slug ?? normalizeSlug(input.slug),
      status: record.status ?? input.status,
      createdAt: record.created_at ?? nowIso(),
    }
  },

  async listOrganizations(actor) {
    requireSuperAdminActor(actor)

    const { data, error } = await client
      .from('organizations')
      .select('id, university_id, name, slug, type, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      universityId: item.university_id as string,
      name: item.name as string,
      slug: item.slug as string,
      type: item.type as OrganizationType,
      status: item.status as OrganizationStatus,
      createdAt: item.created_at as string,
    }))
  },

  async createOrganization(actor, input) {
    requireSuperAdminActor(actor)

    const { data, error } = await client.rpc('create_organization', {
      org_university_id: input.universityId,
      org_name: input.name.trim(),
      org_slug: normalizeSlug(input.slug),
      org_type: input.type,
      org_status: input.status,
    })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const record = data as {
      id?: string
      university_id?: string
      name?: string
      slug?: string
      type?: OrganizationType
      status?: OrganizationStatus
      created_at?: string
    }

    return {
      id: record.id ?? '',
      universityId: record.university_id ?? input.universityId,
      name: record.name ?? input.name.trim(),
      slug: record.slug ?? normalizeSlug(input.slug),
      type: record.type ?? (input.type as OrganizationType),
      status: record.status ?? input.status,
      createdAt: record.created_at ?? nowIso(),
    }
  },

  async listRecruitmentCycles(actor) {
    requireSuperAdminActor(actor)

    const { data, error } = await client
      .from('recruitment_cycles')
      .select('id, organization_id, term, year, status, starts_at, ends_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      organizationId: item.organization_id as string,
      term: item.term as string,
      year: Number(item.year),
      status: item.status as RecruitmentCycleStatus,
      startsAt: (item.starts_at as string | null) ?? null,
      endsAt: (item.ends_at as string | null) ?? null,
      createdAt: item.created_at as string,
    }))
  },

  async createRecruitmentCycle(actor, input) {
    requireSuperAdminActor(actor)

    const { data, error } = await client.rpc('create_recruitment_cycle', {
      cycle_organization_id: input.organizationId,
      cycle_term: normalizeTerm(input.term),
      cycle_year: input.year,
      cycle_status: input.status,
      cycle_starts_at: input.startsAt ?? null,
      cycle_ends_at: input.endsAt ?? null,
    })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const record = data as {
      id?: string
      organization_id?: string
      term?: string
      year?: number
      status?: RecruitmentCycleStatus
      starts_at?: string | null
      ends_at?: string | null
      created_at?: string
    }

    return {
      id: record.id ?? '',
      organizationId: record.organization_id ?? input.organizationId,
      term: record.term ?? normalizeTerm(input.term),
      year: record.year ?? input.year,
      status: record.status ?? input.status,
      startsAt: record.starts_at ?? input.startsAt ?? null,
      endsAt: record.ends_at ?? input.endsAt ?? null,
      createdAt: record.created_at ?? nowIso(),
    }
  },

  async listJoinLinks(actor) {
    requireSuperAdminActor(actor)

    const { data, error } = await client
      .from('join_links')
      .select('id, organization_id, cycle_id, code, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      id: item.id as string,
      organizationId: item.organization_id as string,
      cycleId: item.cycle_id as string,
      code: item.code as string,
      isActive: item.is_active as boolean,
      createdAt: item.created_at as string,
    }))
  },

  async createJoinLink(actor, input) {
    requireSuperAdminActor(actor)

    const { data, error } = await client.rpc('create_join_link', {
      link_organization_id: input.organizationId,
      link_cycle_id: input.cycleId,
      link_code: normalizeJoinCode(input.code),
      link_is_active: input.isActive ?? true,
    })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const record = data as {
      id?: string
      organization_id?: string
      cycle_id?: string
      code?: string
      is_active?: boolean
      created_at?: string
    }

    return {
      id: record.id ?? '',
      organizationId: record.organization_id ?? input.organizationId,
      cycleId: record.cycle_id ?? input.cycleId,
      code: record.code ?? normalizeJoinCode(input.code),
      isActive: record.is_active ?? (input.isActive ?? true),
      createdAt: record.created_at ?? nowIso(),
    }
  },

  async listOrganizationAdmins(actor) {
    requireSuperAdminActor(actor)

    const { data, error } = await client
      .from('organization_admins')
      .select('organization_id, user_id, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return (data ?? []).map((item) => ({
      organizationId: item.organization_id as string,
      userId: item.user_id as string,
      createdAt: item.created_at as string,
    }))
  },

  async assignOrganizationAdmin(actor, input) {
    requireSuperAdminActor(actor)

    const { data, error } = await client.rpc('assign_organization_admin', {
      target_organization_id: input.organizationId,
      target_user_id: input.userId.trim(),
    })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    const record = data as {
      organization_id?: string
      user_id?: string
      created_at?: string
    }

    return {
      organizationId: record.organization_id ?? input.organizationId,
      userId: record.user_id ?? input.userId.trim(),
      createdAt: record.created_at ?? nowIso(),
    }
  },

  async revokeOrganizationAdmin(actor, input) {
    requireSuperAdminActor(actor)

    const { data, error } = await client.rpc('revoke_organization_admin', {
      target_organization_id: input.organizationId,
      target_user_id: input.userId.trim(),
    })

    if (error) {
      throw new SuperAdminServiceError(mapSupabaseMessageToErrorCode(error.message), error.message)
    }

    return Boolean(data)
  },
})

const sharedSuperAdminService = useInMemorySuperAdmin
  ? createInMemorySuperAdminService({ store: sharedInMemoryStore })
  : createSupabaseSuperAdminService(supabase)

export const resetSuperAdminServiceForTests = () => {
  clearStore(sharedInMemoryStore)
}

export const superAdminService: SuperAdminService = {
  async listUniversities(actor) {
    try {
      return await sharedSuperAdminService.listUniversities(actor)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async createUniversity(actor, input) {
    try {
      return await sharedSuperAdminService.createUniversity(actor, input)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async listOrganizations(actor) {
    try {
      return await sharedSuperAdminService.listOrganizations(actor)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async createOrganization(actor, input) {
    try {
      return await sharedSuperAdminService.createOrganization(actor, input)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async listRecruitmentCycles(actor) {
    try {
      return await sharedSuperAdminService.listRecruitmentCycles(actor)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async createRecruitmentCycle(actor, input) {
    try {
      return await sharedSuperAdminService.createRecruitmentCycle(actor, input)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async listJoinLinks(actor) {
    try {
      return await sharedSuperAdminService.listJoinLinks(actor)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async createJoinLink(actor, input) {
    try {
      return await sharedSuperAdminService.createJoinLink(actor, input)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async listOrganizationAdmins(actor) {
    try {
      return await sharedSuperAdminService.listOrganizationAdmins(actor)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async assignOrganizationAdmin(actor, input) {
    try {
      return await sharedSuperAdminService.assignOrganizationAdmin(actor, input)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },

  async revokeOrganizationAdmin(actor, input) {
    try {
      return await sharedSuperAdminService.revokeOrganizationAdmin(actor, input)
    } catch (error) {
      throw mapUnknownErrorToSuperAdminServiceError(error)
    }
  },
}
