import { Link, useLocation } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'

const superAdminLinks = [
  { to: ROUTE_PATHS.superUniversities, label: 'Universities' },
  { to: ROUTE_PATHS.superOrganizations, label: 'Organizations' },
  { to: ROUTE_PATHS.superCycles, label: 'Recruitment cycles' },
  { to: ROUTE_PATHS.superAdmins, label: 'Admin assignments' },
]

export const SuperAdminNav = () => {
  const location = useLocation()
  const baseLinkClass =
    'inline-flex min-h-[2.55rem] items-center justify-center rounded-full border px-4 text-sm font-semibold tracking-[-0.01em] transition'

  return (
    <nav aria-label="Super admin sections" className="flex flex-wrap gap-2">
      {superAdminLinks.map((link) => {
        const linkStateClass =
          location.pathname === link.to
            ? 'border-black bg-black text-white'
            : 'border-black/10 bg-white text-ui-heading hover:border-black/25 hover:bg-black/[0.02]'

        return (
          <Link
            className={`${baseLinkClass} ${linkStateClass}`}
            key={link.to}
            to={link.to}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
