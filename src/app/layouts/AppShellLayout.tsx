import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { authService } from '@/features/auth/authService'
import {
  listAvailableWorkspaces,
  resolveWorkspaceFromPath,
  workspaceToDefaultPath,
  type ActiveWorkspace,
} from '@/features/workspace/workspace'
import { environment } from '@/lib/env'

const roleViewLabels: Record<ActiveWorkspace, string> = {
  student: 'My Rush',
  chapter_admin: 'Chapter Recruiting',
  super_admin: 'Campus Setup',
}

export const AppShellLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, displayName, roles, clearSession } = useAuthSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const availableWorkspaces = listAvailableWorkspaces(roles)
  const activeWorkspace = resolveWorkspaceFromPath(location.pathname, roles)

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
      <header className="sticky top-0 z-20 border-b border-ui-border bg-[color:rgb(255_253_248/0.9)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              className="text-[1.04rem] font-bold tracking-[-0.03em] text-ui-heading [font-family:'Sora',sans-serif]"
              to="/"
            >
              Greek 360
            </Link>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border border-ui-border bg-[color:rgb(21_63_106/0.08)] px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.14em] text-[color:rgb(13_42_71/0.72)]"
                data-testid="app-environment"
              >
                {environment.appEnv}
              </span>
              {isAuthenticated ? (
                <button
                  className="ui-btn-secondary min-h-[2.1rem] whitespace-nowrap px-3 text-xs"
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
              <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-[0.08em] text-[color:rgb(13_42_71/0.65)]">
                {displayName
                  ? `${displayName} · ${roleViewLabels[activeWorkspace]}`
                  : roleViewLabels[activeWorkspace]}
              </p>
              {availableWorkspaces.length > 1 ? (
                <label
                  className="flex w-full flex-col items-start gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:rgb(13_42_71/0.62)] sm:w-auto sm:flex-row sm:items-center sm:gap-2"
                  htmlFor="workspace-switcher"
                >
                  Role view
                  <select
                    className="ui-select h-9 w-full min-w-0 rounded-full px-3 text-xs sm:w-auto sm:min-w-[11rem]"
                    id="workspace-switcher"
                    onChange={(event) =>
                      navigate(workspaceToDefaultPath(event.target.value as ActiveWorkspace))
                    }
                    value={activeWorkspace}
                  >
                    {availableWorkspaces.map((workspace) => (
                      <option key={workspace} value={workspace}>
                        {roleViewLabels[workspace]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-5">
        <Outlet />
      </main>
    </div>
  )
}
