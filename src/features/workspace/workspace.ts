import { ROUTE_PATHS } from '@/app/router/routePaths'
import type { UserRole } from '@/features/auth/session'

export type ActiveWorkspace = 'student' | 'chapter_admin' | 'super_admin'

export interface WorkspaceNavItem {
  href: string
  label: string
}

const workspacePriority: ActiveWorkspace[] = ['super_admin', 'chapter_admin', 'student']

const workspaceRouteMap: Record<ActiveWorkspace, string> = {
  student: ROUTE_PATHS.home,
  chapter_admin: ROUTE_PATHS.adminHome,
  super_admin: ROUTE_PATHS.superHome,
}

const workspaceToRole = (workspace: ActiveWorkspace): UserRole =>
  workspace === 'student' ? 'student' : workspace

export const listAvailableWorkspaces = (roles: UserRole[]): ActiveWorkspace[] => {
  const normalizedRoles = new Set(roles)
  const workspaces: ActiveWorkspace[] = ['student']

  if (normalizedRoles.has('chapter_admin')) {
    workspaces.push('chapter_admin')
  }

  if (normalizedRoles.has('super_admin')) {
    workspaces.push('super_admin')
  }

  return workspaces
}

export const resolveDefaultWorkspace = (roles: UserRole[]): ActiveWorkspace => {
  const normalizedRoles = new Set(roles)

  for (const workspace of workspacePriority) {
    if (normalizedRoles.has(workspaceToRole(workspace))) {
      return workspace
    }
  }

  return 'student'
}

export const workspaceToDefaultPath = (workspace: ActiveWorkspace) => workspaceRouteMap[workspace]

const isStudentWorkspacePath = (pathname: string) => {
  if (pathname === ROUTE_PATHS.home) {
    return true
  }

  if (pathname === ROUTE_PATHS.manualCodeEntry || pathname.startsWith('/join/')) {
    return true
  }

  if (pathname === ROUTE_PATHS.offers) {
    return true
  }

  if (pathname === ROUTE_PATHS.directory) {
    return true
  }

  if (pathname === ROUTE_PATHS.profile) {
    return true
  }

  if (pathname === ROUTE_PATHS.privacySettings || pathname.startsWith('/settings/')) {
    return true
  }

  return false
}

export const resolveWorkspaceFromPath = (
  pathname: string,
  roles: UserRole[]
): ActiveWorkspace => {
  if (pathname.startsWith('/super') && roles.includes('super_admin')) {
    return 'super_admin'
  }

  if (pathname.startsWith('/admin') && roles.includes('chapter_admin')) {
    return 'chapter_admin'
  }

  if (isStudentWorkspacePath(pathname) && roles.includes('student')) {
    return 'student'
  }

  return resolveDefaultWorkspace(roles)
}

export const getWorkspaceNavItems = (
  workspace: ActiveWorkspace,
  roles: UserRole[]
): WorkspaceNavItem[] => {
  const normalizedRoles = new Set(roles)

  if (workspace === 'super_admin' && normalizedRoles.has('super_admin')) {
    return [
      { href: ROUTE_PATHS.superHome, label: 'Overview' },
      { href: ROUTE_PATHS.superUniversities, label: 'Universities' },
      { href: ROUTE_PATHS.superOrganizations, label: 'Organizations' },
      { href: ROUTE_PATHS.superCycles, label: 'Recruitment cycles' },
      { href: ROUTE_PATHS.superAdmins, label: 'Admin assignments' },
    ]
  }

  if (workspace === 'chapter_admin' && normalizedRoles.has('chapter_admin')) {
    return [{ href: ROUTE_PATHS.adminHome, label: 'Overview' }]
  }

  return [
    { href: ROUTE_PATHS.home, label: 'Home' },
    { href: ROUTE_PATHS.manualCodeEntry, label: 'Join code' },
    { href: ROUTE_PATHS.offers, label: 'Offers' },
    { href: ROUTE_PATHS.directory, label: 'Directory' },
    { href: ROUTE_PATHS.profile, label: 'Profile' },
    { href: ROUTE_PATHS.privacySettings, label: 'Privacy' },
  ]
}
