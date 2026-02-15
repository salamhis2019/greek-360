import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

describe('Super-admin setup integration', () => {
  it('supports create university -> organization -> cycle -> admin assignment flow from UI', async () => {
    renderAppAtRoute('/super/universities', {
      isAuthenticated: true,
      userId: 'super-admin-user',
      roles: ['super_admin'],
      needsOnboarding: false,
    })

    fireEvent.change(screen.getByLabelText(/university name/i), {
      target: { value: 'University of Pacific' },
    })
    fireEvent.change(screen.getByLabelText(/university slug/i), {
      target: { value: 'university-of-pacific' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create university/i }))

    await waitFor(() =>
      expect(screen.getByText(/university of pacific/i)).toBeInTheDocument()
    )

    fireEvent.click(
      within(screen.getByRole('navigation', { name: /super admin sections/i })).getByRole('link', {
        name: /organizations/i,
      })
    )
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /^organizations$/i })).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/organization name/i), {
      target: { value: 'Gamma Eta' },
    })
    fireEvent.change(screen.getByLabelText(/organization slug/i), {
      target: { value: 'gamma-eta' },
    })
    fireEvent.change(screen.getByLabelText(/organization type/i), {
      target: { value: 'fraternity' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create organization/i }))

    await waitFor(() => expect(screen.getByText(/gamma eta/i)).toBeInTheDocument())

    fireEvent.click(
      within(screen.getByRole('navigation', { name: /super admin sections/i })).getByRole('link', {
        name: /recruitment cycles/i,
      })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /^recruitment cycles$/i })
      ).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/term/i), {
      target: { value: 'fall' },
    })
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: '2026' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create cycle/i }))

    await waitFor(() => expect(screen.getAllByText(/fall 2026/i).length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: /generate code/i }))
    fireEvent.click(screen.getByRole('button', { name: /create join link/i }))

    await waitFor(() => expect(screen.getByText(/code:/i)).toBeInTheDocument())

    fireEvent.click(
      within(screen.getByRole('navigation', { name: /super admin sections/i })).getByRole('link', {
        name: /admin assignments/i,
      })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /^admin assignments$/i })
      ).toBeInTheDocument()
    )

    fireEvent.change(screen.getByLabelText(/admin user id/i), {
      target: { value: 'org-admin-user-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /assign admin/i }))

    await waitFor(() =>
      expect(screen.getByText(/org-admin-user-1/i)).toBeInTheDocument()
    )
  })
})
