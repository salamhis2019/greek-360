import { Navigate, Outlet } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import type { UserRole } from '@/features/auth/session'

const AuthRedirect = () => <Navigate replace to="/auth" />
const HomeRedirect = () => <Navigate replace to="/home" />

export const RequireAuthFlow = () => {
  const { isAuthenticated, needsOnboarding } = useAuthSession()

  if (isAuthenticated && !needsOnboarding) {
    return <HomeRedirect />
  }

  return <Outlet />
}

export const RequireAuth = () => {
  const { isAuthenticated, needsOnboarding } = useAuthSession()

  if (!isAuthenticated) {
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
  const { isAuthenticated, needsOnboarding, roles } = useAuthSession()

  if (!isAuthenticated || needsOnboarding) {
    return <AuthRedirect />
  }

  if (!roles.includes(role)) {
    return <HomeRedirect />
  }

  return <Outlet />
}
