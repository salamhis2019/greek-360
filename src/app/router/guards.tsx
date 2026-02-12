import { Navigate, Outlet } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { isUserDeleted } from '@/features/privacy/privacyDeletionState'
import type { UserRole } from '@/features/auth/session'

const AuthRedirect = () => <Navigate replace to="/auth" />
const HomeRedirect = () => <Navigate replace to="/home" />

export const RequireAuthFlow = () => {
  const { isAuthenticated, needsOnboarding, userId } = useAuthSession()
  const deletedAccount = isUserDeleted(userId)

  if (isAuthenticated && !needsOnboarding && !deletedAccount) {
    return <HomeRedirect />
  }

  return <Outlet />
}

export const RequireAuth = () => {
  const { isAuthenticated, needsOnboarding, userId } = useAuthSession()
  const deletedAccount = isUserDeleted(userId)

  if (!isAuthenticated || deletedAccount) {
    return <AuthRedirect />
  }

  if (needsOnboarding) {
    return <AuthRedirect />
  }

  return <Outlet />
}

interface RequireRoleProps {
  role: UserRole
}

export const RequireRole = ({ role }: RequireRoleProps) => {
  const { isAuthenticated, needsOnboarding, roles, userId } = useAuthSession()
  const deletedAccount = isUserDeleted(userId)

  if (!isAuthenticated || needsOnboarding || deletedAccount) {
    return <AuthRedirect />
  }

  if (!roles.includes(role)) {
    return <HomeRedirect />
  }

  return <Outlet />
}
