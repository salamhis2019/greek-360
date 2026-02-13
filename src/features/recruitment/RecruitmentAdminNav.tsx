import { Link, useLocation } from 'react-router-dom'

interface RecruitmentAdminNavProps {
  organizationId: string
  cycleId: string
}

const navItems = [
  { label: 'Stage 1', pathSuffix: 'stage-1' },
  { label: 'Stage 2', pathSuffix: 'stage-2' },
  { label: 'Messages', pathSuffix: 'messages' },
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
        const href = `/admin/recruitment/${organizationId}/${cycleId}/${item.pathSuffix}`
        const isActive = location.pathname === href
        const linkStateClass = isActive
          ? 'border-black bg-black text-white'
          : 'border-black/10 bg-white text-ui-heading hover:border-black/25 hover:bg-black/[0.02]'

        return (
          <Link
            className={`${baseLinkClass} ${linkStateClass}`}
            key={item.pathSuffix}
            to={href}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
