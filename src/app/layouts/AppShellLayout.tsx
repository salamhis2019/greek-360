import { Link, Outlet } from 'react-router-dom'
import { environment } from '@/lib/env'

export const AppShellLayout = () => {
  return (
    <div className="min-h-screen bg-ui-canvas text-ui-body">
      <header className="border-b border-ui-border bg-ui-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link className="text-lg font-semibold text-ui-heading" to="/">
            Greek 360
          </Link>
          <span
            className="rounded-full border border-ui-border px-3 py-1 text-xs uppercase tracking-wide text-ui-muted"
            data-testid="app-environment"
          >
            {environment.appEnv}
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
