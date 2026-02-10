import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { AuthSessionProvider } from '@/features/auth/AuthSessionProvider'
import { type AuthSessionState } from '@/features/auth/session'
import { createQueryClient } from './queryClient'

interface AppProvidersProps extends PropsWithChildren {
  initialSession?: AuthSessionState
}

export const AppProviders = ({ children, initialSession }: AppProvidersProps) => {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthSessionProvider initialSession={initialSession}>{children}</AuthSessionProvider>
      </HelmetProvider>
    </QueryClientProvider>
  )
}
