import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  superAdminService,
  SuperAdminServiceError,
  type OrganizationRecord,
  type OrganizationStatus,
  type OrganizationType,
  type SuperAdminActor,
  type UniversityRecord,
} from './superAdminService'
import { SuperAdminNav } from './SuperAdminNav'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof SuperAdminServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const SuperOrganizationsPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo<SuperAdminActor>(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const [universities, setUniversities] = useState<UniversityRecord[]>([])
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [universityId, setUniversityId] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [type, setType] = useState<OrganizationType>('fraternity')
  const [status, setStatus] = useState<OrganizationStatus>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [universityRecords, organizationRecords] = await Promise.all([
        superAdminService.listUniversities(actor),
        superAdminService.listOrganizations(actor),
      ])

      setUniversities(universityRecords)
      setOrganizations(organizationRecords)

      if (universityRecords.length > 0 && !universityId) {
        setUniversityId(universityRecords[0].id)
      }
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    }
  }, [actor, universityId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const submitOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await superAdminService.createOrganization(actor, {
        universityId,
        name,
        slug,
        type,
        status,
      })

      setName('')
      setSlug('')
      setType('fraternity')
      setStatus('active')
      await loadData()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getUniversityName = (targetUniversityId: string) => {
    const university = universities.find((item) => item.id === targetUniversityId)
    return university?.name ?? 'Unknown university'
  }

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Organizations</h1>
      <p className="text-sm text-ui-muted">Create fraternities and sororities under each university.</p>
      <SuperAdminNav />

      <form
        className="space-y-3 rounded-lg border border-ui-border p-4"
        onSubmit={submitOrganization}
      >
        <h2 className="text-sm font-semibold text-ui-heading">Create organization</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="organization-university">
            University
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="organization-university"
            onChange={(event) => setUniversityId(event.target.value)}
            value={universityId}
          >
            {universities.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="organization-name">
            Organization name
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="organization-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="organization-slug">
            Organization slug
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="organization-slug"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="gamma-eta"
            value={slug}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="organization-type">
            Organization type
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="organization-type"
            onChange={(event) => setType(event.target.value as OrganizationType)}
            value={type}
          >
            <option value="fraternity">fraternity</option>
            <option value="sorority">sorority</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="organization-status">
            Organization status
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="organization-status"
            onChange={(event) => setStatus(event.target.value as OrganizationStatus)}
            value={status}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmitting || universities.length === 0}
          type="submit"
        >
          Create organization
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Current organizations</h2>
        {organizations.length === 0 ? (
          <p className="text-sm text-ui-muted">No organizations configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {organizations.map((organization) => (
              <li className="rounded-lg border border-ui-border p-3" key={organization.id}>
                <p className="text-sm font-semibold text-ui-heading">{organization.name}</p>
                <p className="text-xs text-ui-muted">
                  {organization.type} | {organization.slug} |{' '}
                  {getUniversityName(organization.universityId)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
