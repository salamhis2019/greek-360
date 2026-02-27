import { Link, useLocation } from 'react-router-dom'
import { TEST_IDS } from '@/app/testing/testIds'

interface RecruitmentAdminNavProps {
  organizationId: string
  cycleId: string
}

const navItems = [
  {
    label: 'Review stage 1',
    testId: TEST_IDS.recruitment.navStage1Link,
    href: (organizationId: string, cycleId: string) =>
      `/admin/recruitment/${organizationId}/${cycleId}/stage-1`,
  },
  {
    label: 'Review stage 2',
    testId: TEST_IDS.recruitment.navStage2Link,
    href: (organizationId: string, cycleId: string) =>
      `/admin/recruitment/${organizationId}/${cycleId}/stage-2`,
  },
  {
    label: 'Send messages',
    testId: TEST_IDS.recruitment.navMessagesLink,
    href: (organizationId: string, cycleId: string) =>
      `/admin/recruitment/${organizationId}/${cycleId}/messages`,
  },
  {
    label: 'Manage members',
    testId: TEST_IDS.recruitment.navMembersLink,
    href: (organizationId: string, _cycleId: string) => `/admin/members/${organizationId}`,
  },
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
            data-testid={item.testId}
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
