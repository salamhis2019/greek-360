import { Link, useLocation } from 'react-router-dom'

interface RecruitmentAdminNavProps {
  organizationId: string
  cycleId: string
}

const navItems = [
  {
    label: 'Review stage 1',
    href: (organizationId: string, cycleId: string) =>
      `/admin/recruitment/${organizationId}/${cycleId}/stage-1`,
  },
  {
    label: 'Review stage 2',
    href: (organizationId: string, cycleId: string) =>
      `/admin/recruitment/${organizationId}/${cycleId}/stage-2`,
  },
  {
    label: 'Send messages',
    href: (organizationId: string, cycleId: string) =>
      `/admin/recruitment/${organizationId}/${cycleId}/messages`,
  },
  { label: 'Manage members', href: (organizationId: string, _cycleId: string) => `/admin/members/${organizationId}` },
]

export const RecruitmentAdminNav = ({
  organizationId,
  cycleId,
}: RecruitmentAdminNavProps) => {
  const location = useLocation()
  const baseLinkClass = 'ui-action-link min-h-[2.85rem] text-sm'

  return (
    <nav aria-label="Recruitment admin sections" className="ui-action-list">
      {navItems.map((item) => {
        const href = item.href(organizationId, cycleId)
        const isActive = location.pathname === href
        const linkStateClass = isActive
          ? 'ui-action-link-primary'
          : ''

        return (
          <Link
            className={`${baseLinkClass} ${linkStateClass}`}
            key={item.label}
            to={href}
          >
            <span>{item.label}</span>
            <span aria-hidden="true">{'->'}</span>
          </Link>
        )
      })}
    </nav>
  )
}
