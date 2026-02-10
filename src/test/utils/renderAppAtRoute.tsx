import { RouterProvider } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AppProviders } from '@/app/providers/AppProviders'
import { createMemoryAppRouter } from '@/app/router/createAppRouter'
import { defaultAuthSessionState, type AuthSessionState } from '@/features/auth/session'

export const renderAppAtRoute = (
  initialRoute: string,
  sessionOverrides: Partial<AuthSessionState> = {}
) => {
  const initialSession: AuthSessionState = {
    ...defaultAuthSessionState,
    ...sessionOverrides,
  }

  const router = createMemoryAppRouter([initialRoute])

  return render(
    <AppProviders initialSession={initialSession}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
