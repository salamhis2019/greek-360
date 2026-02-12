import { Link, Outlet } from 'react-router-dom'
import { environment } from '@/lib/env'

export const AppShellLayout = () => {
  return (
    <div className="min-h-screen bg-ui-canvas text-ui-body">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-5">
          <Link className="text-[1.02rem] font-semibold tracking-[-0.02em] text-ui-heading" to="/">
            Greek 360
          </Link>
          <span
            className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-black/50"
            data-testid="app-environment"
          >
            {environment.appEnv}
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-5">
        <Outlet />
      </main>
    </div>
  )
}
