import { Link, useLocation } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'

const superAdminLinks = [
  { to: ROUTE_PATHS.superHome, label: 'Campus setup home' },
  { to: ROUTE_PATHS.superUniversities, label: 'Universities' },
  { to: ROUTE_PATHS.superOrganizations, label: 'Organizations' },
  { to: ROUTE_PATHS.superCycles, label: 'Recruitment cycles' },
  { to: ROUTE_PATHS.superAdmins, label: 'Admin assignments' },
]

export const SuperAdminNav = () => {
  const location = useLocation()
  const baseLinkClass =
    'ui-action-link min-h-[2.85rem] text-sm'

  return (
    <nav aria-label="Super admin sections" className="ui-action-list">
      {superAdminLinks.map((link) => {
        const linkStateClass =
          location.pathname === link.to
            ? 'ui-action-link-primary'
            : ''

        return (
          <Link
            className={`${baseLinkClass} ${linkStateClass}`}
            key={link.to}
            to={link.to}
          >
            <span>{link.label}</span>
            <span aria-hidden="true">{'->'}</span>
          </Link>
        )
      })}
    </nav>
  )
}
