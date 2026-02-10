import { Navigate, Outlet } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import type { UserRole } from '@/features/auth/session'

const AuthRedirect = () => <Navigate replace to="/auth" />

export const RequireAuth = () => {
  const { isAuthenticated } = useAuthSession()

  if (!isAuthenticated) {
    return <AuthRedirect />
  }

  return <Outlet />
}

interface RequireRoleProps {
  role: UserRole
}

export const RequireRole = ({ role }: RequireRoleProps) => {
  const { isAuthenticated, roles } = useAuthSession()

  if (!isAuthenticated || !roles.includes(role)) {
    return <AuthRedirect />
  }

  return <Outlet />
}
