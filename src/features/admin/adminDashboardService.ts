import type { UserRole } from '@/features/auth/session'
import { listOffersForMessaging } from '@/features/offers/offerService'
import { recruitmentService } from '@/features/recruitment/recruitmentService'
import { superAdminService } from '@/features/super-admin/superAdminService'
import { environment } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export interface AdminCycleSummaryRecord {
  organizationId: string
  organizationName: string
  cycleId: string
  cycleTerm: string
  cycleYear: number
  cycleStatus: string
  stage1PendingCount: number
  stage2PendingCount: number
  pendingOffersCount: number
}

export type AdminDashboardServiceErrorCode = 'unauthenticated' | 'forbidden' | 'unknown'

export class AdminDashboardServiceError extends Error {
  code: AdminDashboardServiceErrorCode

  constructor(code: AdminDashboardServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface ListManageableCyclesActor {
  actorUserId: string | null
  actorRoles: UserRole[]
}

interface AdminDashboardService {
  listManageableCycles: (actor: ListManageableCyclesActor) => Promise<AdminCycleSummaryRecord[]>
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryAdminDashboard =
  import.meta.env.MODE === 'test' ||
  forceInMemoryFromSession ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const mapUnknownToAdminDashboardServiceError = (error: unknown): AdminDashboardServiceError => {
  if (error instanceof AdminDashboardServiceError) {
    return error
  }

  return new AdminDashboardServiceError('unknown', 'Something went wrong. Please try again.')
}

const createInMemoryAdminDashboardService = (): AdminDashboardService => ({
  async listManageableCycles(actor) {
    if (!actor.actorUserId) {
      throw new AdminDashboardServiceError('unauthenticated', 'Authentication is required.')
    }

    if (!actor.actorRoles.includes('chapter_admin') && !actor.actorRoles.includes('super_admin')) {
      throw new AdminDashboardServiceError(
        'forbidden',
        'Chapter-admin or super-admin access is required.'
      )
    }

    const [organizations, cycles, allOffers] = await Promise.all([
      superAdminService.listOrganizations({
        actorUserId: 'admin-dashboard-system',
        actorRoles: ['super_admin'],
      }),
      superAdminService.listRecruitmentCycles({
        actorUserId: 'admin-dashboard-system',
        actorRoles: ['super_admin'],
      }),
      listOffersForMessaging(),
    ])

    const manageableOrganizationIds = actor.actorRoles.includes('super_admin')
      ? organizations.map((organization) => organization.id)
      : await superAdminService.listAdminOrganizationIds(actor.actorUserId)

    const manageableCycles = cycles.filter((cycle) =>
      manageableOrganizationIds.includes(cycle.organizationId)
    )

    const summarizedCycles = await Promise.all(
      manageableCycles.map(async (cycle) => {
        const [stage1Queue, stage2Queue] = await Promise.all([
          recruitmentService.listStage1Queue(
            {
              actorUserId: actor.actorUserId,
              actorRoles: actor.actorRoles,
              adminOrganizationIds: manageableOrganizationIds,
            },
            {
              organizationId: cycle.organizationId,
              cycleId: cycle.id,
            }
          ),
          recruitmentService.listStage2Queue(
            {
              actorUserId: actor.actorUserId,
              actorRoles: actor.actorRoles,
              adminOrganizationIds: manageableOrganizationIds,
            },
            {
              organizationId: cycle.organizationId,
              cycleId: cycle.id,
            }
          ),
        ])

        const organization = organizations.find((item) => item.id === cycle.organizationId)

        return {
          organizationId: cycle.organizationId,
          organizationName: organization?.name ?? 'Unknown organization',
          cycleId: cycle.id,
          cycleTerm: cycle.term,
          cycleYear: cycle.year,
          cycleStatus: cycle.status,
          stage1PendingCount: stage1Queue.length,
          stage2PendingCount: stage2Queue.length,
          pendingOffersCount: allOffers.filter(
            (offer) =>
              offer.organizationId === cycle.organizationId &&
              offer.cycleId === cycle.id &&
              offer.status === 'pending'
          ).length,
        } satisfies AdminCycleSummaryRecord
      })
    )

    return summarizedCycles.sort((first, second) => {
      const orgComparison = first.organizationName.localeCompare(second.organizationName)
      if (orgComparison !== 0) {
        return orgComparison
      }

      if (first.cycleYear !== second.cycleYear) {
        return second.cycleYear - first.cycleYear
      }

      return first.cycleTerm.localeCompare(second.cycleTerm)
    })
  },
})

const mapSupabaseMessageToErrorCode = (message: string): AdminDashboardServiceErrorCode => {
  const normalized = message.toLowerCase()

  if (normalized.includes('authentication required')) {
    return 'unauthenticated'
  }

  if (normalized.includes('forbidden')) {
    return 'forbidden'
  }

  return 'unknown'
}

const createSupabaseAdminDashboardService = (): AdminDashboardService => ({
  async listManageableCycles(actor) {
    if (!actor.actorUserId) {
      throw new AdminDashboardServiceError('unauthenticated', 'Authentication is required.')
    }

    const { data, error } = await supabase.rpc('list_my_admin_cycles')

    if (error) {
      throw new AdminDashboardServiceError(
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
          organizationId: String(typedRow.organization_id ?? ''),
          organizationName: String(typedRow.organization_name ?? ''),
          cycleId: String(typedRow.cycle_id ?? ''),
          cycleTerm: String(typedRow.cycle_term ?? ''),
          cycleYear: Number(typedRow.cycle_year ?? 0),
          cycleStatus: String(typedRow.cycle_status ?? 'draft'),
          stage1PendingCount: Number(typedRow.stage1_pending_count ?? 0),
          stage2PendingCount: Number(typedRow.stage2_pending_count ?? 0),
          pendingOffersCount: Number(typedRow.pending_offers_count ?? 0),
        } satisfies AdminCycleSummaryRecord
      })
      .filter((row) => row.cycleId.length > 0)
  },
})

const sharedAdminDashboardService = useInMemoryAdminDashboard
  ? createInMemoryAdminDashboardService()
  : createSupabaseAdminDashboardService()

export const adminDashboardService: AdminDashboardService = {
  async listManageableCycles(actor) {
    try {
      return await sharedAdminDashboardService.listManageableCycles(actor)
    } catch (error) {
      throw mapUnknownToAdminDashboardServiceError(error)
    }
  },
}
