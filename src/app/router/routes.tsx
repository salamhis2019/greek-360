import { Link, type RouteObject } from 'react-router-dom'
import { AppShellLayout } from '@/app/layouts/AppShellLayout'
import { RouteSkeletonPage } from '@/app/ui/RouteSkeletonPage'
import { AuthOnboardingPage } from '@/features/auth/AuthOnboardingPage'
import { DirectoryPage } from '@/features/directory/DirectoryPage'
import { JoinInterestPage } from '@/features/interest/JoinInterestPage'
import { MessagesPage } from '@/features/messaging/MessagesPage'
import { OffersInboxPage } from '@/features/offers/OffersInboxPage'
import { PrivacySettingsPage } from '@/features/privacy/PrivacySettingsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { RecruitmentStage1Page } from '@/features/recruitment/RecruitmentStage1Page'
import { RecruitmentStage2Page } from '@/features/recruitment/RecruitmentStage2Page'
import { SuperAdminsPage } from '@/features/super-admin/SuperAdminsPage'
import { SuperCyclesPage } from '@/features/super-admin/SuperCyclesPage'
import { SuperOrganizationsPage } from '@/features/super-admin/SuperOrganizationsPage'
import { SuperUniversitiesPage } from '@/features/super-admin/SuperUniversitiesPage'
import { RequireAuth, RequireAuthFlow, RequireRole } from './guards'
import { ROUTE_PATHS } from './routePaths'

const landingLinks = [
  { href: ROUTE_PATHS.auth, label: 'Sign in' },
  { href: ROUTE_PATHS.manualCodeEntry, label: 'Enter join code' },
  { href: ROUTE_PATHS.home, label: 'Student home' },
  { href: ROUTE_PATHS.superUniversities, label: 'Super-admin console' },
]

const LandingPage = () => (
  <RouteSkeletonPage
    title="Greek 360"
    description="MVP shell is ready with public, student, chapter-admin, and super-admin route zones."
    actions={
      <div className="flex flex-wrap gap-2">
        {landingLinks.map((item) => (
          <Link
            className="ui-btn-secondary min-h-[2.5rem] px-4 text-[0.85rem]"
            key={item.href}
            to={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
    }
  />
)

const StudentHomePage = () => (
  <RouteSkeletonPage
    title="Student home"
    description="Authenticated student dashboard shell for offers, profile, and directory."
  />
)

const MembersPage = () => (
  <RouteSkeletonPage
    title="Members"
    description="Chapter membership management shell and directory tools placeholder."
  />
)

const NotFoundPage = () => (
  <RouteSkeletonPage title="Not found" description="The requested route does not exist in this environment." />
)

export const appRouteObjects: RouteObject[] = [
  {
    path: ROUTE_PATHS.landing,
    element: <AppShellLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        element: <RequireAuthFlow />,
        children: [{ path: ROUTE_PATHS.auth.slice(1), element: <AuthOnboardingPage /> }],
      },
      { path: ROUTE_PATHS.joinWithCode.slice(1), element: <JoinInterestPage mode="deep-link" /> },
      { path: ROUTE_PATHS.manualCodeEntry.slice(1), element: <JoinInterestPage mode="manual" /> },
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTE_PATHS.home.slice(1), element: <StudentHomePage /> },
          { path: ROUTE_PATHS.offers.slice(1), element: <OffersInboxPage /> },
          { path: ROUTE_PATHS.directory.slice(1), element: <DirectoryPage /> },
          { path: ROUTE_PATHS.profile.slice(1), element: <ProfilePage /> },
          { path: ROUTE_PATHS.privacySettings.slice(1), element: <PrivacySettingsPage /> },
        ],
      },
      {
        element: <RequireRole role="chapter_admin" />,
        children: [
          { path: ROUTE_PATHS.adminStage1.slice(1), element: <RecruitmentStage1Page /> },
          { path: ROUTE_PATHS.adminStage2.slice(1), element: <RecruitmentStage2Page /> },
          { path: ROUTE_PATHS.adminMessages.slice(1), element: <MessagesPage /> },
          { path: ROUTE_PATHS.adminMembers.slice(1), element: <MembersPage /> },
        ],
      },
      {
        element: <RequireRole role="super_admin" />,
        children: [
          { path: ROUTE_PATHS.superUniversities.slice(1), element: <SuperUniversitiesPage /> },
          { path: ROUTE_PATHS.superOrganizations.slice(1), element: <SuperOrganizationsPage /> },
          { path: ROUTE_PATHS.superAdmins.slice(1), element: <SuperAdminsPage /> },
          { path: ROUTE_PATHS.superCycles.slice(1), element: <SuperCyclesPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
