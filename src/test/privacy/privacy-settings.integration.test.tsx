import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

describe('Privacy settings integration', () => {
  it('supports export generation from settings', async () => {
    renderAppAtRoute('/settings/privacy', {
      isAuthenticated: true,
      userId: 'phase8-ui-student-export',
      displayName: 'Phase 8 UI Export Student',
      roles: ['student'],
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /privacy settings/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /generate export package/i }))

    await waitFor(() =>
      expect(screen.getByText(/export package generated/i)).toBeInTheDocument()
    )
  })

  it('requires OTP re-auth before allowing deletion requests', async () => {
    renderAppAtRoute('/settings/privacy', {
      isAuthenticated: true,
      userId: 'phase8-ui-student-delete',
      displayName: 'Phase 8 UI Delete Student',
      roles: ['student'],
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /privacy settings/i })).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/one-time passcode/i), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /request account deletion/i }))

    await waitFor(() =>
      expect(screen.getByText(/verification code is invalid/i)).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/one-time passcode/i), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /request account deletion/i }))

    await waitFor(() =>
      expect(screen.getByText(/deletion request submitted/i)).toBeInTheDocument()
    )
  })
})
