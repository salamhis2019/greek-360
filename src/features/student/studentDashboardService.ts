import { interestService } from '@/features/interest/interestService'
import { offerService, type OfferStatus } from '@/features/offers/offerService'
import { superAdminService } from '@/features/super-admin/superAdminService'
import { environment } from '@/lib/env'

export type StudentInterestStatus =
  | 'submitted'
  | 'offer_pending'
  | 'offer_accepted'
  | 'offer_declined'
  | 'offer_expired'
  | 'membership_active'

export interface StudentInterestSummaryRecord {
  interestEntryId: string
  organizationId: string
  organizationName: string
  cycleId: string
  cycleTerm: string
  cycleYear: number
  submittedAt: string
  status: StudentInterestStatus
}

export interface StudentActiveMembershipSummary {
  membershipId: string
  organizationId: string
  organizationName: string
  joinedAt: string
}

export interface StudentHomeSummary {
  pendingOffersCount: number
  activeMembership: StudentActiveMembershipSummary | null
  interests: StudentInterestSummaryRecord[]
}

export type StudentDashboardServiceErrorCode = 'unauthenticated' | 'unknown'

export class StudentDashboardServiceError extends Error {
  code: StudentDashboardServiceErrorCode

  constructor(code: StudentDashboardServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface StudentDashboardService {
  getSummary: (actorUserId: string | null) => Promise<StudentHomeSummary>
}

const forceInMemoryFromSession =
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem('greek360.dev.useInMemory') === 'true'

const useInMemoryStudentDashboard =
  import.meta.env.MODE === 'test' ||
  forceInMemoryFromSession ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

const mapUnknownToStudentDashboardServiceError = (error: unknown): StudentDashboardServiceError => {
  if (error instanceof StudentDashboardServiceError) {
    return error
  }

  return new StudentDashboardServiceError('unknown', 'Something went wrong. Please try again.')
}

const deriveInterestStatus = (
  offerStatus: OfferStatus | null,
  hasActiveMembership: boolean
): StudentInterestStatus => {
  if (hasActiveMembership) {
    return 'membership_active'
  }

  if (offerStatus === 'pending') {
    return 'offer_pending'
  }

  if (offerStatus === 'accepted') {
    return 'offer_accepted'
  }

  if (offerStatus === 'declined') {
    return 'offer_declined'
  }

  if (offerStatus === 'expired') {
    return 'offer_expired'
  }

  return 'submitted'
}

const createInMemoryStudentDashboardService = (): StudentDashboardService => ({
  async getSummary(actorUserId) {
    if (!actorUserId) {
      throw new StudentDashboardServiceError('unauthenticated', 'Authentication is required.')
    }

    const [interests, offers, memberships, organizations, cycles] = await Promise.all([
      interestService.listInterestEntriesForUser(actorUserId),
      offerService.listOffersForStudent(actorUserId),
      offerService.listMembershipsForUser(actorUserId),
      superAdminService.listOrganizations({
        actorUserId: 'student-dashboard-system',
        actorRoles: ['super_admin'],
      }),
      superAdminService.listRecruitmentCycles({
        actorUserId: 'student-dashboard-system',
        actorRoles: ['super_admin'],
      }),
    ])

    const organizationsById = new Map(
      organizations.map((organization) => [organization.id, organization])
    )
    const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]))
    const offersByInterestId = new Map(offers.map((offer) => [offer.interestEntryId, offer]))
    const activeMembership = memberships.find((membership) => membership.status === 'active') ?? null

    const summarizedInterests: StudentInterestSummaryRecord[] = interests
      .map((interest) => {
        const organization = organizationsById.get(interest.organizationId)
        const cycle = cyclesById.get(interest.cycleId)
        const offer = offersByInterestId.get(interest.id) ?? null

        return {
          interestEntryId: interest.id,
          organizationId: interest.organizationId,
          organizationName: organization?.name ?? 'Unknown organization',
          cycleId: interest.cycleId,
          cycleTerm: cycle?.term ?? 'unknown',
          cycleYear: cycle?.year ?? 0,
          submittedAt: interest.createdAt,
          status: deriveInterestStatus(
            offer?.status ?? null,
            Boolean(activeMembership && activeMembership.organizationId === interest.organizationId)
          ),
        }
      })
      .sort((first, second) => second.submittedAt.localeCompare(first.submittedAt))

    return {
      pendingOffersCount: offers.filter((offer) => offer.status === 'pending').length,
      activeMembership: activeMembership
        ? {
            membershipId: activeMembership.id,
            organizationId: activeMembership.organizationId,
            organizationName: activeMembership.organizationName ?? 'Unknown organization',
            joinedAt: activeMembership.joinedAt,
          }
        : null,
      interests: summarizedInterests,
    }
  },
})

interface StudentSummaryRow {
  interest_entry_id: string
  organization_id: string
  organization_name: string
  cycle_id: string
  cycle_term: string
  cycle_year: number
  submitted_at: string
  offer_status: OfferStatus | null
}

const createSupabaseStudentDashboardService = (): StudentDashboardService => ({
  async getSummary(actorUserId) {
    if (!actorUserId) {
      throw new StudentDashboardServiceError('unauthenticated', 'Authentication is required.')
    }

    const [summaryRows, memberships] = await Promise.all([
      interestService.listStudentSummaryRows(),
      offerService.listMembershipsForUser(actorUserId),
    ])

    const activeMembership = memberships.find((membership) => membership.status === 'active') ?? null

    const interests = summaryRows
      .map((row) => ({
        interestEntryId: row.interest_entry_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        cycleId: row.cycle_id,
        cycleTerm: row.cycle_term,
        cycleYear: Number(row.cycle_year),
        submittedAt: row.submitted_at,
        status: deriveInterestStatus(
          row.offer_status,
          Boolean(activeMembership && activeMembership.organizationId === row.organization_id)
        ),
      }))
      .sort((first, second) => second.submittedAt.localeCompare(first.submittedAt))

    return {
      pendingOffersCount: summaryRows.filter((row) => row.offer_status === 'pending').length,
      activeMembership: activeMembership
        ? {
            membershipId: activeMembership.id,
            organizationId: activeMembership.organizationId,
            organizationName: activeMembership.organizationName ?? 'Unknown organization',
            joinedAt: activeMembership.joinedAt,
          }
        : null,
      interests,
    }
  },
})

const sharedStudentDashboardService = useInMemoryStudentDashboard
  ? createInMemoryStudentDashboardService()
  : createSupabaseStudentDashboardService()

export const studentDashboardService: StudentDashboardService = {
  async getSummary(actorUserId) {
    try {
      return await sharedStudentDashboardService.getSummary(actorUserId)
    } catch (error) {
      throw mapUnknownToStudentDashboardServiceError(error)
    }
  },
}

export type { StudentSummaryRow }
