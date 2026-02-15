import { Link, useLocation } from 'react-router-dom'

interface RecruitmentAdminNavProps {
  organizationId: string
  cycleId: string
}

const navItems = [
  { label: 'Stage 1', href: (organizationId: string, cycleId: string) => `/admin/recruitment/${organizationId}/${cycleId}/stage-1` },
  { label: 'Stage 2', href: (organizationId: string, cycleId: string) => `/admin/recruitment/${organizationId}/${cycleId}/stage-2` },
  { label: 'Messages', href: (organizationId: string, cycleId: string) => `/admin/recruitment/${organizationId}/${cycleId}/messages` },
  { label: 'Members', href: (organizationId: string, _cycleId: string) => `/admin/members/${organizationId}` },
]

export const RecruitmentAdminNav = ({
  organizationId,
  cycleId,
}: RecruitmentAdminNavProps) => {
  const location = useLocation()
  const baseLinkClass =
    'inline-flex min-h-[2.55rem] items-center justify-center rounded-full border px-4 text-sm font-semibold tracking-[-0.01em] transition'

  return (
    <nav aria-label="Recruitment admin sections" className="flex flex-wrap gap-2">
      {navItems.map((item) => {
        const href = item.href(organizationId, cycleId)
        const isActive = location.pathname === href
        const linkStateClass = isActive
          ? 'border-black bg-black !text-white'
          : 'border-black/10 bg-white text-ui-heading hover:border-black/25 hover:bg-black/[0.02]'

        return (
          <Link
            className={`${baseLinkClass} ${linkStateClass}`}
            key={item.label}
            to={href}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
