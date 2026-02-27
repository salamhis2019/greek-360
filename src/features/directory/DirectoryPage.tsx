import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TEST_IDS } from '@/app/testing/testIds'
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
    <section className="ui-page">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Directory</p>
        <h1 className="ui-page-title" data-testid={TEST_IDS.directory.heading}>
          Directory
        </h1>
        <p className="ui-page-description">
          Search your campus directory by person or organization. Private contact details are only
          visible for shared chapter memberships.
        </p>
      </header>

      <div className="space-y-2">
        <label className="ui-label" htmlFor="directory-search">
          Search by name or organization
        </label>
        <input
          className="ui-input"
          id="directory-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people or chapters"
          value={search}
        />
      </div>

      {directoryQuery.isLoading ? <p className="text-sm text-ui-muted">Loading directory...</p> : null}
      {directoryQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(directoryQuery.error)}</p>
      ) : null}

      {!directoryQuery.isLoading && !directoryQuery.isError && records.length === 0 ? (
        <p className="text-sm text-ui-muted">No matching people found.</p>
      ) : null}

      {records.length > 0 ? (
        <ul className="space-y-3">
          {records.map((record) => (
            <li className="ui-panel" key={record.userId}>
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
