import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  superAdminService,
  SuperAdminServiceError,
  type SuperAdminActor,
  type UniversityRecord,
  type UniversityStatus,
} from './superAdminService'
import { SuperAdminNav } from './SuperAdminNav'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof SuperAdminServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const SuperUniversitiesPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo<SuperAdminActor>(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const [universities, setUniversities] = useState<UniversityRecord[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<UniversityStatus>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadUniversities = useCallback(async () => {
    try {
      const records = await superAdminService.listUniversities(actor)
      setUniversities(records)
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    }
  }, [actor])

  useEffect(() => {
    void loadUniversities()
  }, [loadUniversities])

  const submitUniversity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await superAdminService.createUniversity(actor, { name, slug, status })
      setName('')
      setSlug('')
      setStatus('active')
      await loadUniversities()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Super admin</p>
        <h1 className="ui-page-title">Universities</h1>
        <p className="ui-page-description">
          Create and activate universities before configuring chapters and cycles.
        </p>
      </header>
      <SuperAdminNav />

      <form className="ui-panel space-y-3" onSubmit={submitUniversity}>
        <h2 className="ui-subheading">Create university</h2>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="university-name">
            University name
          </label>
          <input
            className="ui-input"
            id="university-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="university-slug">
            University slug
          </label>
          <input
            className="ui-input"
            id="university-slug"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="university-of-pacific"
            value={slug}
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="university-status">
            University status
          </label>
          <select
            className="ui-select"
            id="university-status"
            onChange={(event) => setStatus(event.target.value as UniversityStatus)}
            value={status}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
        <button
          className="ui-btn-primary"
          disabled={isSubmitting}
          type="submit"
        >
          Create university
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="ui-subheading">Current universities</h2>
        {universities.length === 0 ? (
          <p className="text-sm text-ui-muted">No universities configured yet.</p>
        ) : (
          <ul className="space-y-3">
            {universities.map((university) => (
              <li className="ui-panel" key={university.id}>
                <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">{university.name}</p>
                <p className="ui-meta">
                  {university.slug} | {university.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
