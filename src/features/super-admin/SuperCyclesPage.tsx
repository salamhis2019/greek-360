import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  superAdminService,
  SuperAdminServiceError,
  type JoinLinkRecord,
  type OrganizationRecord,
  type RecruitmentCycleRecord,
  type RecruitmentCycleStatus,
  type SuperAdminActor,
} from './superAdminService'
import { SuperAdminNav } from './SuperAdminNav'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof SuperAdminServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const generateJoinCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const codeCharacters = Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  )

  return codeCharacters.join('')
}

export const SuperCyclesPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo<SuperAdminActor>(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [cycles, setCycles] = useState<RecruitmentCycleRecord[]>([])
  const [joinLinks, setJoinLinks] = useState<JoinLinkRecord[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [term, setTerm] = useState('fall')
  const [year, setYear] = useState('2026')
  const [cycleStatus, setCycleStatus] = useState<RecruitmentCycleStatus>('active')
  const [joinOrganizationId, setJoinOrganizationId] = useState('')
  const [joinCycleId, setJoinCycleId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isSubmittingCycle, setIsSubmittingCycle] = useState(false)
  const [isSubmittingJoinCode, setIsSubmittingJoinCode] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [organizationRecords, cycleRecords, joinLinkRecords] = await Promise.all([
        superAdminService.listOrganizations(actor),
        superAdminService.listRecruitmentCycles(actor),
        superAdminService.listJoinLinks(actor),
      ])

      setOrganizations(organizationRecords)
      setCycles(cycleRecords)
      setJoinLinks(joinLinkRecords)

      if (organizationRecords.length > 0 && !organizationId) {
        setOrganizationId(organizationRecords[0].id)
      }

      if (organizationRecords.length > 0 && !joinOrganizationId) {
        setJoinOrganizationId(organizationRecords[0].id)
      }
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    }
  }, [actor, joinOrganizationId, organizationId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const cyclesForJoinOrganization = cycles.filter(
    (cycle) => cycle.organizationId === joinOrganizationId
  )

  useEffect(() => {
    if (cyclesForJoinOrganization.length === 0) {
      setJoinCycleId('')
      return
    }

    if (!cyclesForJoinOrganization.some((cycle) => cycle.id === joinCycleId)) {
      setJoinCycleId(cyclesForJoinOrganization[0].id)
    }
  }, [cyclesForJoinOrganization, joinCycleId])

  const submitCycle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmittingCycle(true)
    setErrorMessage(null)

    try {
      const createdCycle = await superAdminService.createRecruitmentCycle(actor, {
        organizationId,
        term,
        year: Number(year),
        status: cycleStatus,
      })

      setJoinOrganizationId(createdCycle.organizationId)
      setJoinCycleId(createdCycle.id)
      await loadData()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmittingCycle(false)
    }
  }

  const submitJoinLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmittingJoinCode(true)
    setErrorMessage(null)

    try {
      await superAdminService.createJoinLink(actor, {
        organizationId: joinOrganizationId,
        cycleId: joinCycleId,
        code: joinCode,
      })
      setJoinCode('')
      await loadData()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmittingJoinCode(false)
    }
  }

  const getOrganizationName = (targetOrganizationId: string) => {
    const organization = organizations.find((item) => item.id === targetOrganizationId)
    return organization?.name ?? 'Unknown organization'
  }

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Recruitment cycles</h1>
      <p className="text-sm text-ui-muted">
        Configure recruitment cycles and generate static join codes.
      </p>
      <SuperAdminNav />

      <form className="space-y-3 rounded-lg border border-ui-border p-4" onSubmit={submitCycle}>
        <h2 className="text-sm font-semibold text-ui-heading">Create cycle</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="cycle-organization">
            Organization
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="cycle-organization"
            onChange={(event) => setOrganizationId(event.target.value)}
            value={organizationId}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="cycle-term">
            Term
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="cycle-term"
            onChange={(event) => setTerm(event.target.value)}
            value={term}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="cycle-year">
            Year
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="cycle-year"
            inputMode="numeric"
            onChange={(event) => setYear(event.target.value)}
            value={year}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="cycle-status">
            Cycle status
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="cycle-status"
            onChange={(event) => setCycleStatus(event.target.value as RecruitmentCycleStatus)}
            value={cycleStatus}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="closed">closed</option>
          </select>
        </div>
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmittingCycle || organizations.length === 0}
          type="submit"
        >
          Create cycle
        </button>
      </form>

      <form className="space-y-3 rounded-lg border border-ui-border p-4" onSubmit={submitJoinLink}>
        <h2 className="text-sm font-semibold text-ui-heading">Generate static join code</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="join-organization">
            Organization
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="join-organization"
            onChange={(event) => setJoinOrganizationId(event.target.value)}
            value={joinOrganizationId}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="join-cycle">
            Cycle
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="join-cycle"
            onChange={(event) => setJoinCycleId(event.target.value)}
            value={joinCycleId}
          >
            {cyclesForJoinOrganization.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.term} {cycle.year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="join-code">
            Join code
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="join-code"
            onChange={(event) => setJoinCode(event.target.value)}
            value={joinCode}
          />
        </div>
        <button
          className="w-full rounded-lg border border-ui-border px-4 py-2 text-sm font-medium text-ui-heading"
          onClick={() => setJoinCode(generateJoinCode())}
          type="button"
        >
          Generate code
        </button>
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmittingJoinCode || !joinOrganizationId || !joinCycleId}
          type="submit"
        >
          Create join link
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Current cycles</h2>
        {cycles.length === 0 ? (
          <p className="text-sm text-ui-muted">No cycles configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {cycles.map((cycle) => (
              <li className="rounded-lg border border-ui-border p-3" key={cycle.id}>
                <p className="text-sm font-semibold text-ui-heading">
                  {cycle.term} {cycle.year}
                </p>
                <p className="text-xs text-ui-muted">
                  {getOrganizationName(cycle.organizationId)} | {cycle.status}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    className="rounded-lg border border-ui-border px-2 py-1 text-xs font-medium text-ui-heading"
                    to={`/admin/recruitment/${cycle.organizationId}/${cycle.id}/stage-1`}
                  >
                    Open stage 1
                  </Link>
                  <Link
                    className="rounded-lg border border-ui-border px-2 py-1 text-xs font-medium text-ui-heading"
                    to={`/admin/recruitment/${cycle.organizationId}/${cycle.id}/stage-2`}
                  >
                    Open stage 2
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Current join links</h2>
        {joinLinks.length === 0 ? (
          <p className="text-sm text-ui-muted">No join links generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {joinLinks.map((joinLink) => (
              <li className="rounded-lg border border-ui-border p-3" key={joinLink.id}>
                <p className="text-sm font-semibold text-ui-heading">Code: {joinLink.code}</p>
                <p className="text-xs text-ui-muted">
                  {getOrganizationName(joinLink.organizationId)} | {joinLink.isActive ? 'active' : 'inactive'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
