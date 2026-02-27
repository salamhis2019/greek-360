import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { TEST_IDS } from '@/app/testing/testIds'
import { PageActionList } from '@/app/ui/PageActionList'
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
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Campus setup</p>
        <h1 className="ui-page-title" data-testid={TEST_IDS.superAdmin.cyclesHeading}>
          Recruitment cycles
        </h1>
        <p className="ui-page-description">
          Configure recruitment cycles and generate static join codes.
        </p>
      </header>
      <SuperAdminNav />

      <form className="ui-panel space-y-3" onSubmit={submitCycle}>
        <h2 className="ui-subheading">Create cycle</h2>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="cycle-organization">
            Organization
          </label>
          <select
            className="ui-select"
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
        <div className="space-y-2">
          <label className="ui-label" htmlFor="cycle-term">
            Term
          </label>
          <input
            className="ui-input"
            id="cycle-term"
            onChange={(event) => setTerm(event.target.value)}
            value={term}
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="cycle-year">
            Year
          </label>
          <input
            className="ui-input"
            id="cycle-year"
            inputMode="numeric"
            onChange={(event) => setYear(event.target.value)}
            value={year}
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="cycle-status">
            Cycle status
          </label>
          <select
            className="ui-select"
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
          className="ui-btn-primary"
          disabled={isSubmittingCycle || organizations.length === 0}
          type="submit"
        >
          Create cycle
        </button>
      </form>

      <form className="ui-panel space-y-3" onSubmit={submitJoinLink}>
        <h2 className="ui-subheading">Generate static join code</h2>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="join-organization">
            Organization
          </label>
          <select
            className="ui-select"
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
        <div className="space-y-2">
          <label className="ui-label" htmlFor="join-cycle">
            Cycle
          </label>
          <select
            className="ui-select"
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
        <div className="space-y-2">
          <label className="ui-label" htmlFor="join-code">
            Join code
          </label>
          <input
            className="ui-input"
            id="join-code"
            onChange={(event) => setJoinCode(event.target.value)}
            value={joinCode}
          />
        </div>
        <button
          className="ui-btn-secondary"
          onClick={() => setJoinCode(generateJoinCode())}
          type="button"
        >
          Generate code
        </button>
        {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
        <button
          className="ui-btn-primary"
          disabled={isSubmittingJoinCode || !joinOrganizationId || !joinCycleId}
          type="submit"
        >
          Create join link
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="ui-subheading">Current cycles</h2>
        {cycles.length === 0 ? (
          <p className="text-sm text-ui-muted">No cycles configured yet.</p>
        ) : (
          <ul className="space-y-3">
            {cycles.map((cycle) => (
              <li className="ui-panel" key={cycle.id}>
                <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">
                  {cycle.term} {cycle.year}
                </p>
                <p className="ui-meta">
                  {getOrganizationName(cycle.organizationId)} | {cycle.status}
                </p>
                <div className="mt-3">
                  <PageActionList
                    actions={[
                      {
                        label: 'Open chapter recruiting',
                        hint: 'Jump to chapter-level cycle overview',
                        to: '/admin',
                        testId: TEST_IDS.superCycles.cycleOpenAdminLink(cycle.id),
                      },
                      {
                        label: 'Review stage 1',
                        hint: 'Process initial shortlist decisions',
                        to: `/admin/recruitment/${cycle.organizationId}/${cycle.id}/stage-1`,
                        tone: 'primary',
                        testId: TEST_IDS.superCycles.cycleStage1Link(cycle.id),
                      },
                      {
                        label: 'Review stage 2',
                        hint: 'Finalize yes and no decisions',
                        to: `/admin/recruitment/${cycle.organizationId}/${cycle.id}/stage-2`,
                        testId: TEST_IDS.superCycles.cycleStage2Link(cycle.id),
                      },
                    ]}
                    title="Cycle shortcuts"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="ui-subheading">Current join links</h2>
        {joinLinks.length === 0 ? (
          <p className="text-sm text-ui-muted">No join links generated yet.</p>
        ) : (
          <ul className="space-y-3">
            {joinLinks.map((joinLink) => (
              <li className="ui-panel" key={joinLink.id}>
                <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">Code: {joinLink.code}</p>
                <p className="ui-meta">
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
