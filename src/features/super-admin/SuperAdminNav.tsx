import { Link } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'

const superAdminLinks = [
  { to: ROUTE_PATHS.superUniversities, label: 'Universities' },
  { to: ROUTE_PATHS.superOrganizations, label: 'Organizations' },
  { to: ROUTE_PATHS.superCycles, label: 'Recruitment cycles' },
  { to: ROUTE_PATHS.superAdmins, label: 'Admin assignments' },
]

export const SuperAdminNav = () => {
  return (
    <nav className="flex flex-wrap gap-2">
      {superAdminLinks.map((link) => (
        <Link
          className="rounded-lg border border-ui-border px-3 py-1 text-sm text-ui-heading"
          key={link.to}
          to={link.to}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
