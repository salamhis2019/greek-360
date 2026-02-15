import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { authService } from '@/features/auth/authService'
import {
  getWorkspaceNavItems,
  listAvailableWorkspaces,
  resolveWorkspaceFromPath,
  workspaceToDefaultPath,
  type ActiveWorkspace,
} from '@/features/workspace/workspace'
import { environment } from '@/lib/env'

const workspaceLabels: Record<ActiveWorkspace, string> = {
  student: 'Student',
  chapter_admin: 'Chapter admin',
  super_admin: 'Super admin',
}

const publicNavItems = [
  { href: ROUTE_PATHS.auth, label: 'Sign in' },
  { href: ROUTE_PATHS.manualCodeEntry, label: 'Enter code' },
]

const primaryNavItemBaseClass = [
  'inline-flex min-h-[2.2rem] shrink-0 items-center justify-center rounded-full border',
  'px-3 text-xs font-semibold tracking-[0.01em] transition',
].join(' ')

const isNavItemActive = (pathname: string, href: string) => {
  if (href === ROUTE_PATHS.home) {
    return pathname === ROUTE_PATHS.home
  }

  if (href === ROUTE_PATHS.adminHome) {
    return pathname.startsWith('/admin')
  }

  if (href === ROUTE_PATHS.superHome) {
    return pathname.startsWith('/super')
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export const AppShellLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, displayName, roles, clearSession } = useAuthSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const availableWorkspaces = listAvailableWorkspaces(roles)
  const activeWorkspace = resolveWorkspaceFromPath(location.pathname, roles)
  const navItems = isAuthenticated
    ? getWorkspaceNavItems(activeWorkspace, roles)
    : publicNavItems

  const submitSignOut = async () => {
    setIsSigningOut(true)

    try {
      await authService.signOut()
    } catch {
      // Clear local session regardless so users are never stuck.
    } finally {
      clearSession()
      setIsSigningOut(false)
      navigate(ROUTE_PATHS.auth)
    }
  }

  return (
    <div className="min-h-screen bg-ui-canvas text-ui-body">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link className="text-[1.02rem] font-semibold tracking-[-0.02em] text-ui-heading" to="/">
              Greek 360
            </Link>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-black/50"
                data-testid="app-environment"
              >
                {environment.appEnv}
              </span>
              {isAuthenticated ? (
                <button
                  className="ui-btn-secondary min-h-[2.1rem] px-3 text-xs"
                  disabled={isSigningOut}
                  onClick={() => void submitSignOut()}
                  type="button"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </button>
              ) : null}
            </div>
          </div>

          {isAuthenticated ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-black/52">
                {displayName
                  ? `${displayName} · ${workspaceLabels[activeWorkspace]}`
                  : workspaceLabels[activeWorkspace]}
              </p>
              {availableWorkspaces.length > 1 ? (
                <label
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-black/48"
                  htmlFor="workspace-switcher"
                >
                  Workspace
                  <select
                    className="ui-select h-9 min-w-[11rem] rounded-full px-3 text-xs"
                    id="workspace-switcher"
                    onChange={(event) =>
                      navigate(workspaceToDefaultPath(event.target.value as ActiveWorkspace))
                    }
                    value={activeWorkspace}
                  >
                    {availableWorkspaces.map((workspace) => (
                      <option key={workspace} value={workspace}>
                        {workspaceLabels[workspace]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          <nav aria-label="Primary navigation" className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(location.pathname, item.href)

              return (
                <Link
                  className={`${primaryNavItemBaseClass} ${
                    isActive
                      ? 'border-black bg-black !text-white'
                      : 'border-black/10 bg-white text-ui-heading hover:border-black/25 hover:bg-black/[0.02]'
                  }`}
                  key={item.href}
                  to={item.href}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-5">
        <Outlet />
      </main>
    </div>
  )
}
