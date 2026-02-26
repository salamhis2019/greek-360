import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

describe('Route authorization baseline', () => {
  it('blocks student access to chapter admin routes', () => {
    renderAppAtRoute('/admin/recruitment/org-1/cycle-1/stage-1', {
      isAuthenticated: true,
      roles: ['student'],
    })

    expect(screen.getByRole('heading', { name: /my rush/i })).toBeInTheDocument()
  })

  it('blocks chapter admin access to super-admin routes', () => {
    renderAppAtRoute('/super/universities', {
      isAuthenticated: true,
      roles: ['chapter_admin'],
    })

    expect(screen.getByRole('heading', { name: /chapter recruiting/i })).toBeInTheDocument()
  })

  it('forces authenticated users with incomplete onboarding back to auth flow', () => {
    renderAppAtRoute('/home', {
      isAuthenticated: true,
      userId: 'user-1',
      roles: ['student'],
      needsOnboarding: true,
    })

    expect(screen.getByRole('heading', { name: /complete your profile/i })).toBeInTheDocument()
  })

  it('redirects fully onboarded users away from auth route', () => {
    renderAppAtRoute('/auth', {
      isAuthenticated: true,
      userId: 'user-1',
      roles: ['student'],
      needsOnboarding: false,
      displayName: 'Alex Student',
    })

    expect(screen.getByRole('heading', { name: /my rush/i })).toBeInTheDocument()
  })

  it('redirects fully onboarded super-admin users to campus setup', () => {
    renderAppAtRoute('/auth', {
      isAuthenticated: true,
      userId: 'user-2',
      roles: ['student', 'super_admin'],
      needsOnboarding: false,
      displayName: 'Casey Admin',
    })

    expect(screen.getByRole('heading', { name: /campus setup/i })).toBeInTheDocument()
  })
})
