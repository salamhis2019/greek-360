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
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Admin assignments</h1>
      <p className="text-sm text-ui-muted">Assign and remove chapter admins for each organization.</p>
      <SuperAdminNav />

      <form
        className="space-y-3 rounded-lg border border-ui-border p-4"
        onSubmit={submitAdminAssignment}
      >
        <h2 className="text-sm font-semibold text-ui-heading">Assign admin</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="assignment-organization">
            Organization
          </label>
          <select
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
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
        <div>
          <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="assignment-user-id">
            Admin user id
          </label>
          <input
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="assignment-user-id"
            onChange={(event) => setUserIdInput(event.target.value)}
            placeholder="org-admin-user-1"
            value={userIdInput}
          />
        </div>
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmitting || organizations.length === 0}
          type="submit"
        >
          Assign admin
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ui-heading">Current admin assignments</h2>
        {adminAssignments.length === 0 ? (
          <p className="text-sm text-ui-muted">No admin assignments configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {adminAssignments.map((assignment) => (
              <li
                className="flex items-center justify-between rounded-lg border border-ui-border p-3"
                key={`${assignment.organizationId}-${assignment.userId}`}
              >
                <div>
                  <p className="text-sm font-semibold text-ui-heading">{assignment.userId}</p>
                  <p className="text-xs text-ui-muted">
                    {getOrganizationName(assignment.organizationId)}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-ui-border px-3 py-1 text-xs text-ui-body"
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
