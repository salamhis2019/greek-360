import { Link, type RouteObject } from 'react-router-dom'
import { AppShellLayout } from '@/app/layouts/AppShellLayout'
import { RouteSkeletonPage } from '@/app/ui/RouteSkeletonPage'
import { AuthOnboardingPage } from '@/features/auth/AuthOnboardingPage'
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
            className="rounded-lg border border-ui-border px-3 py-2 text-sm text-ui-heading"
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

const JoinByCodePage = () => (
  <RouteSkeletonPage
    title="Join a chapter"
    description="Join code entry and deep-link route are scaffolded for recruitment interest capture."
  />
)

const StudentHomePage = () => (
  <RouteSkeletonPage
    title="Student home"
    description="Authenticated student dashboard shell for offers, profile, and directory."
  />
)

const OffersPage = () => (
  <RouteSkeletonPage title="Offers" description="Offer response workflow skeleton is ready for Phase 5." />
)

const DirectoryPage = () => (
  <RouteSkeletonPage
    title="Directory"
    description="Campus directory shell is ready for privacy-gated profile visibility in Phase 6."
  />
)

const ProfilePage = () => (
  <RouteSkeletonPage title="Profile" description="Profile shell with avatar and contact details placeholder." />
)

const PrivacySettingsPage = () => (
  <RouteSkeletonPage
    title="Privacy settings"
    description="Data export and deletion request controls are scaffolded for Phase 8."
  />
)

const Stage1Page = () => (
  <RouteSkeletonPage
    title="Stage 1 queue"
    description="Chapter admin shortlist/no workflow scaffolded for rapid one-tap triage."
  />
)

const Stage2Page = () => (
  <RouteSkeletonPage
    title="Stage 2 decisions"
    description="Chapter admin final yes/no workflow shell for pending offer generation."
  />
)

const MessagesPage = () => (
  <RouteSkeletonPage
    title="Messages"
    description="Acceptance and rejection message composer placeholder for Phase 7."
  />
)

const MembersPage = () => (
  <RouteSkeletonPage
    title="Members"
    description="Chapter membership management shell and directory tools placeholder."
  />
)

const SuperUniversitiesPage = () => (
  <RouteSkeletonPage
    title="Universities"
    description="Super-admin setup shell for campus creation and activation."
  />
)

const SuperOrganizationsPage = () => (
  <RouteSkeletonPage
    title="Organizations"
    description="Super-admin organization creation shell with fraternity and sorority support."
  />
)

const SuperAdminsPage = () => (
  <RouteSkeletonPage
    title="Admin assignments"
    description="Super-admin-only admin assignment shell for chapter operations."
  />
)

const SuperCyclesPage = () => (
  <RouteSkeletonPage
    title="Recruitment cycles"
    description="Cycle and static join-code management shell for each organization."
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
      { path: ROUTE_PATHS.joinWithCode.slice(1), element: <JoinByCodePage /> },
      { path: ROUTE_PATHS.manualCodeEntry.slice(1), element: <JoinByCodePage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTE_PATHS.home.slice(1), element: <StudentHomePage /> },
          { path: ROUTE_PATHS.offers.slice(1), element: <OffersPage /> },
          { path: ROUTE_PATHS.directory.slice(1), element: <DirectoryPage /> },
          { path: ROUTE_PATHS.profile.slice(1), element: <ProfilePage /> },
          { path: ROUTE_PATHS.privacySettings.slice(1), element: <PrivacySettingsPage /> },
        ],
      },
      {
        element: <RequireRole role="chapter_admin" />,
        children: [
          { path: ROUTE_PATHS.adminStage1.slice(1), element: <Stage1Page /> },
          { path: ROUTE_PATHS.adminStage2.slice(1), element: <Stage2Page /> },
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
