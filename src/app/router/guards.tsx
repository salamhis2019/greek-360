import { Navigate, Outlet } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { isUserDeleted } from '@/features/privacy/privacyDeletionState'
import type { UserRole } from '@/features/auth/session'
import { resolveDefaultWorkspace, workspaceToDefaultPath } from '@/features/workspace/workspace'

const AuthRedirect = () => <Navigate replace to="/auth" />

export const RequireAuthFlow = () => {
  const { isAuthenticated, needsOnboarding, userId, roles } = useAuthSession()
  const deletedAccount = isUserDeleted(userId)

  if (isAuthenticated && !needsOnboarding && !deletedAccount) {
    return (
      <Navigate
        replace
        to={workspaceToDefaultPath(resolveDefaultWorkspace(roles))}
      />
    )
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
    return (
      <Navigate
        replace
        to={workspaceToDefaultPath(resolveDefaultWorkspace(roles))}
      />
    )
  }

  return <Outlet />
}
