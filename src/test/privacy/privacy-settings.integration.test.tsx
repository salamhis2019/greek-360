import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { authService } from '@/features/auth/authService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const bootstrapStudent = async (phoneNumber: string, name: string) => {
  await authService.startPhoneAuth(phoneNumber)
  const verified = await authService.verifyPhoneAuth({
    phoneNumber,
    otpCode: '123456',
  })

  await authService.upsertProfile({
    userId: verified.profile.userId,
    name,
  })

  return verified.profile.userId
}

describe('Privacy settings integration', () => {
  it('supports export generation from settings', async () => {
    const studentUserId = await bootstrapStudent('+14155556001', 'Phase 8 UI Export Student')

    renderAppAtRoute('/settings/privacy', {
      isAuthenticated: true,
      userId: studentUserId,
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

  it('requires phone confirmation before allowing deletion requests', async () => {
    const studentUserId = await bootstrapStudent('+14155556002', 'Phase 8 UI Delete Student')

    renderAppAtRoute('/settings/privacy', {
      isAuthenticated: true,
      userId: studentUserId,
      displayName: 'Phase 8 UI Delete Student',
      roles: ['student'],
    })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /privacy settings/i })).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/confirm phone number/i), {
      target: { value: '+14155550000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /request account deletion/i }))

    await waitFor(() =>
      expect(screen.getByText(/phone number does not match your account/i)).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/confirm phone number/i), {
      target: { value: '+14155556002' },
    })
    fireEvent.click(screen.getByRole('button', { name: /request account deletion/i }))

    await waitFor(() =>
      expect(screen.getByText(/deletion request submitted/i)).toBeInTheDocument()
    )
  })
})
