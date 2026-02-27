import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShellLayout } from '@/app/layouts/AppShellLayout'
import { RouteSkeletonPage } from '@/app/ui/RouteSkeletonPage'
import { AuthOnboardingPage } from '@/features/auth/AuthOnboardingPage'
import { DirectoryPage } from '@/features/directory/DirectoryPage'
import { JoinInterestPage } from '@/features/interest/JoinInterestPage'
import { MessagesPage } from '@/features/messaging/MessagesPage'
import { OffersInboxPage } from '@/features/offers/OffersInboxPage'
import { AdminDashboardPage } from '@/features/admin/AdminDashboardPage'
import { AdminMembersPage } from '@/features/admin/AdminMembersPage'
import { PrivacySettingsPage } from '@/features/privacy/PrivacySettingsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { RecruitmentStage1Page } from '@/features/recruitment/RecruitmentStage1Page'
import { RecruitmentStage2Page } from '@/features/recruitment/RecruitmentStage2Page'
import { StudentHomePage } from '@/features/student/StudentHomePage'
import { SuperAdminsPage } from '@/features/super-admin/SuperAdminsPage'
import { SuperCyclesPage } from '@/features/super-admin/SuperCyclesPage'
import { SuperDashboardPage } from '@/features/super-admin/SuperDashboardPage'
import { SuperOrganizationsPage } from '@/features/super-admin/SuperOrganizationsPage'
import { SuperUniversitiesPage } from '@/features/super-admin/SuperUniversitiesPage'
import { RequireAuth, RequireAuthFlow, RequireRole } from './guards'
import { ROUTE_PATHS } from './routePaths'

const NotFoundPage = () => (
  <RouteSkeletonPage title="Not found" description="The requested route does not exist in this environment." />
)

export const appRouteObjects: RouteObject[] = [
  {
    path: ROUTE_PATHS.landing,
    element: <AppShellLayout />,
    children: [
      {
        element: <RequireAuthFlow />,
        children: [
          { index: true, element: <Navigate replace to={ROUTE_PATHS.auth} /> },
          { path: ROUTE_PATHS.auth.slice(1), element: <AuthOnboardingPage /> },
        ],
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
          { path: ROUTE_PATHS.adminHome.slice(1), element: <AdminDashboardPage /> },
          { path: ROUTE_PATHS.adminStage1.slice(1), element: <RecruitmentStage1Page /> },
          { path: ROUTE_PATHS.adminStage2.slice(1), element: <RecruitmentStage2Page /> },
          { path: ROUTE_PATHS.adminMessages.slice(1), element: <MessagesPage /> },
          { path: ROUTE_PATHS.adminMembers.slice(1), element: <AdminMembersPage /> },
        ],
      },
      {
        element: <RequireRole role="super_admin" />,
        children: [
          { path: ROUTE_PATHS.superHome.slice(1), element: <SuperDashboardPage /> },
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
