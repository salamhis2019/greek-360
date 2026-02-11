import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

describe('Auth onboarding flow integration', () => {
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
      expect(screen.getByRole('heading', { name: /student home/i })).toBeInTheDocument()
    )
  })
})
