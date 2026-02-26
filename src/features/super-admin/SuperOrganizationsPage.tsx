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
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Campus setup</p>
        <h1 className="ui-page-title">Organizations</h1>
        <p className="ui-page-description">Create fraternities and sororities under each university.</p>
      </header>
      <SuperAdminNav />

      <form
        className="ui-panel space-y-3"
        onSubmit={submitOrganization}
      >
        <h2 className="ui-subheading">Create organization</h2>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="organization-university">
            University
          </label>
          <select
            className="ui-select"
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
        <div className="space-y-2">
          <label className="ui-label" htmlFor="organization-name">
            Organization name
          </label>
          <input
            className="ui-input"
            id="organization-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="organization-slug">
            Organization slug
          </label>
          <input
            className="ui-input"
            id="organization-slug"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="gamma-eta"
            value={slug}
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="organization-type">
            Organization type
          </label>
          <select
            className="ui-select"
            id="organization-type"
            onChange={(event) => setType(event.target.value as OrganizationType)}
            value={type}
          >
            <option value="fraternity">fraternity</option>
            <option value="sorority">sorority</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="organization-status">
            Organization status
          </label>
          <select
            className="ui-select"
            id="organization-status"
            onChange={(event) => setStatus(event.target.value as OrganizationStatus)}
            value={status}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
        <button
          className="ui-btn-primary"
          disabled={isSubmitting || universities.length === 0}
          type="submit"
        >
          Create organization
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="ui-subheading">Current organizations</h2>
        {organizations.length === 0 ? (
          <p className="text-sm text-ui-muted">No organizations configured yet.</p>
        ) : (
          <ul className="space-y-3">
            {organizations.map((organization) => (
              <li className="ui-panel" key={organization.id}>
                <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">{organization.name}</p>
                <p className="ui-meta">
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
