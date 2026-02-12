import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { directoryService, DirectoryServiceError } from '@/features/directory/directoryService'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof DirectoryServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const formatOrganizationNames = (organizationNames: string[]) => {
  if (organizationNames.length === 0) {
    return 'No active organization memberships'
  }

  return organizationNames.join(', ')
}

export const DirectoryPage = () => {
  const { userId, roles } = useAuthSession()
  const [search, setSearch] = useState('')

  const normalizedSearch = useMemo(() => search.trim(), [search])

  const directoryQuery = useQuery({
    queryKey: ['directory', userId, roles, normalizedSearch],
    queryFn: () =>
      directoryService.searchPeople({
        actorUserId: userId,
        actorRoles: roles,
        search: normalizedSearch,
      }),
  })

  const records = directoryQuery.data ?? []

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Directory</h1>
      <p className="text-sm text-ui-muted">
        Search your campus directory by person or organization. Private contact details are only
        visible for shared chapter memberships.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-ui-body" htmlFor="directory-search">
          Search by name or organization
        </label>
        <input
          className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
          id="directory-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people or chapters"
          value={search}
        />
      </div>

      {directoryQuery.isLoading ? <p className="text-sm text-ui-muted">Loading directory...</p> : null}
      {directoryQuery.isError ? (
        <p className="text-sm text-red-700">{resolveErrorMessage(directoryQuery.error)}</p>
      ) : null}

      {!directoryQuery.isLoading && !directoryQuery.isError && records.length === 0 ? (
        <p className="text-sm text-ui-muted">No matching people found.</p>
      ) : null}

      {records.length > 0 ? (
        <ul className="space-y-3">
          {records.map((record) => (
            <li className="rounded-lg border border-ui-border p-4" key={record.userId}>
              <p className="text-sm font-semibold text-ui-heading">{record.name}</p>
              <p className="mt-1 text-xs text-ui-muted">
                Organizations: {formatOrganizationNames(record.organizationNames)}
              </p>
              <p className="mt-2 text-xs text-ui-muted">
                Phone: {record.phoneE164 ? record.phoneE164 : 'Hidden'}
              </p>
              <p className="text-xs text-ui-muted">Email: {record.email ? record.email : 'Hidden'}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
