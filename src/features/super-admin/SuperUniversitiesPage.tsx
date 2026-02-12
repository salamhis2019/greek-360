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
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Universities</h1>
      <p className="text-sm text-ui-muted">
        Create and activate universities before configuring chapters and cycles.
      </p>
      <SuperAdminNav />

      <form className="space-y-3 rounded-lg border border-ui-border p-4" onSubmit={submitUniversity}>
        <h2 className="text-sm font-semibold text-ui-heading">Create university</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="university-name">
            University name
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="university-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="university-slug">
            University slug
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="university-slug"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="university-of-pacific"
            value={slug}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="university-status">
            University status
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="university-status"
            onChange={(event) => setStatus(event.target.value as UniversityStatus)}
            value={status}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          Create university
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Current universities</h2>
        {universities.length === 0 ? (
          <p className="text-sm text-ui-muted">No universities configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {universities.map((university) => (
              <li className="rounded-lg border border-ui-border p-3" key={university.id}>
                <p className="text-sm font-semibold text-ui-heading">{university.name}</p>
                <p className="text-xs text-ui-muted">
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
