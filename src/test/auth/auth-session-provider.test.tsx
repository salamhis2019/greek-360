import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthSessionProvider, useAuthSession } from '@/features/auth/AuthSessionProvider'

const AuthSessionProbe = () => {
  const { isAuthenticated, roles, setSession, clearSession } = useAuthSession()

  return (
    <div>
      <p data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'anonymous'}</p>
      <p data-testid="auth-roles">{roles.join(',')}</p>
      <button
        onClick={() =>
          setSession({
            isAuthenticated: true,
            userId: 'user-1',
            phoneE164: '+14155550123',
            displayName: null,
            needsOnboarding: true,
            roles: ['chapter_admin'],
          })
        }
        type="button"
      >
        set-session
      </button>
      <button onClick={clearSession} type="button">
        clear-session
      </button>
    </div>
  )
}

describe('AuthSessionProvider', () => {
  it('defaults to anonymous when persisted session cannot be parsed', () => {
    window.sessionStorage.setItem('greek360.auth.session', '{bad-json')

    render(
      <AuthSessionProvider>
        <AuthSessionProbe />
      </AuthSessionProvider>
    )

    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous')
  })

  it('hydrates from initial session and persists updates', async () => {
    render(
      <AuthSessionProvider
        initialSession={{
          isAuthenticated: true,
          userId: 'user-2',
          phoneE164: '+14155550124',
          displayName: 'Existing User',
          needsOnboarding: false,
          roles: ['student'],
        }}
      >
        <AuthSessionProbe />
      </AuthSessionProvider>
    )

    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('auth-roles')).toHaveTextContent('student')
    fireEvent.click(screen.getByRole('button', { name: 'set-session' }))
    await waitFor(() =>
      expect(screen.getByTestId('auth-roles')).toHaveTextContent('chapter_admin')
    )

    const persistedSession = window.sessionStorage.getItem('greek360.auth.session')
    expect(persistedSession).toContain('chapter_admin')
  })

  it('throws when hook is used outside provider', () => {
    const renderOutsideProvider = () => render(<AuthSessionProbe />)
    expect(renderOutsideProvider).toThrowError(/must be used within AuthSessionProvider/i)
  })
})
