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

  return (
    <nav aria-label="Recruitment admin sections" className="flex flex-wrap gap-2">
      {navItems.map((item) => {
        const href = `/admin/recruitment/${organizationId}/${cycleId}/${item.pathSuffix}`
        const isActive = location.pathname === href

        return (
          <Link
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              isActive
                ? 'border-ui-heading bg-ui-heading text-ui-surface'
                : 'border-ui-border text-ui-heading'
            }`}
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
