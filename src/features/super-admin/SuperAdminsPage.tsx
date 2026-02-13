import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  superAdminService,
  SuperAdminServiceError,
  type OrganizationAdminRecord,
  type OrganizationRecord,
  type SuperAdminActor,
} from './superAdminService'
import { SuperAdminNav } from './SuperAdminNav'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof SuperAdminServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const SuperAdminsPage = () => {
  const { userId, roles } = useAuthSession()
  const actor = useMemo<SuperAdminActor>(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [adminAssignments, setAdminAssignments] = useState<OrganizationAdminRecord[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [organizationRecords, adminRecords] = await Promise.all([
        superAdminService.listOrganizations(actor),
        superAdminService.listOrganizationAdmins(actor),
      ])

      setOrganizations(organizationRecords)
      setAdminAssignments(adminRecords)

      if (organizationRecords.length > 0 && !organizationId) {
        setOrganizationId(organizationRecords[0].id)
      }
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    }
  }, [actor, organizationId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const submitAdminAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await superAdminService.assignOrganizationAdmin(actor, {
        organizationId,
        userId: userIdInput,
      })
      setUserIdInput('')
      await loadData()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeAssignment = async (assignment: OrganizationAdminRecord) => {
    setErrorMessage(null)

    try {
      await superAdminService.revokeOrganizationAdmin(actor, {
        organizationId: assignment.organizationId,
        userId: assignment.userId,
      })
      await loadData()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
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
        <p className="ui-page-eyebrow">Super admin</p>
        <h1 className="ui-page-title">Admin assignments</h1>
        <p className="ui-page-description">
          Assign and remove chapter admins for each organization.
        </p>
      </header>
      <SuperAdminNav />

      <form
        className="ui-panel space-y-3"
        onSubmit={submitAdminAssignment}
      >
        <h2 className="ui-subheading">Assign admin</h2>
        <div className="space-y-2">
          <label className="ui-label" htmlFor="assignment-organization">
            Organization
          </label>
          <select
            className="ui-select"
            id="assignment-organization"
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
          <label className="ui-label" htmlFor="assignment-user-id">
            Admin user id
          </label>
          <input
            className="ui-input"
            id="assignment-user-id"
            onChange={(event) => setUserIdInput(event.target.value)}
            placeholder="org-admin-user-1"
            value={userIdInput}
          />
        </div>
        {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
        <button
          className="ui-btn-primary"
          disabled={isSubmitting || organizations.length === 0}
          type="submit"
        >
          Assign admin
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="ui-subheading">Current admin assignments</h2>
        {adminAssignments.length === 0 ? (
          <p className="text-sm text-ui-muted">No admin assignments configured yet.</p>
        ) : (
          <ul className="space-y-3">
            {adminAssignments.map((assignment) => (
              <li
                className="ui-panel flex items-center justify-between gap-3"
                key={`${assignment.organizationId}-${assignment.userId}`}
              >
                <div>
                  <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">{assignment.userId}</p>
                  <p className="ui-meta">
                    {getOrganizationName(assignment.organizationId)}
                  </p>
                </div>
                <button
                  className="ui-btn-secondary min-h-[2.35rem] px-4 text-xs"
                  onClick={() => void removeAssignment(assignment)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
