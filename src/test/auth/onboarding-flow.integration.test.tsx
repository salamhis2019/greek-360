import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'
import { authService, resetAuthServiceForTests } from '@/features/auth/authService'

describe('Auth onboarding flow integration', () => {
  it('preserves elevated roles after profile completion so super-admin redirect succeeds', async () => {
    resetAuthServiceForTests()
    await authService.startPhoneAuth('+14155550123')
    const verifyResult = await authService.verifyPhoneAuth({
      phoneNumber: '+14155550123',
      otpCode: '123456',
    })

    renderAppAtRoute('/auth?redirect=/super/universities', {
      isAuthenticated: true,
      userId: verifyResult.profile.userId,
      phoneE164: verifyResult.profile.phoneE164,
      displayName: verifyResult.profile.name,
      needsOnboarding: true,
      roles: ['super_admin'],
    })

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Alex Super Admin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      const persistedSession = window.sessionStorage.getItem('greek360.auth.session')
      expect(persistedSession).toBeTruthy()

      const parsedSession = JSON.parse(persistedSession ?? '{}') as {
        needsOnboarding?: boolean
        roles?: string[]
      }

      expect(parsedSession.needsOnboarding).toBe(false)
      expect(parsedSession.roles).toContain('super_admin')
    })
  })

  it('requires first-login name capture before granting normal authenticated navigation', async () => {
    renderAppAtRoute('/auth')

    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '(415) 555-0123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))

    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /complete your profile/i })).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Alex Student' },
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my rush/i })).toBeInTheDocument()
    )
  })
})
