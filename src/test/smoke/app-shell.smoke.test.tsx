import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

describe('Phase 0 app shell smoke tests', () => {
  it('renders the public landing shell with environment marker', () => {
    renderAppAtRoute('/')

    expect(screen.getByRole('heading', { name: /greek 360/i })).toBeInTheDocument()
    expect(screen.getByTestId('app-environment')).toBeInTheDocument()
  })

  it('redirects unauthenticated visitors away from authenticated routes', () => {
    renderAppAtRoute('/home')

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders chapter admin stage 1 route for an admin session', () => {
    renderAppAtRoute('/admin/recruitment/org-1/cycle-1/stage-1', {
      isAuthenticated: true,
      roles: ['chapter_admin'],
    })

    expect(screen.getByRole('heading', { name: /stage 1 queue/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review stage 1/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^stage 1$/i })).not.toBeInTheDocument()
  })

  it('does not render top pill navigation for authenticated users', () => {
    renderAppAtRoute('/home', {
      isAuthenticated: true,
      roles: ['student'],
      userId: 'student-user-1',
      displayName: 'Taylor Student',
    })

    expect(screen.queryByRole('navigation', { name: /primary navigation/i })).not.toBeInTheDocument()
  })

  it('uses role-first wording for the shell role switcher', () => {
    renderAppAtRoute('/home', {
      isAuthenticated: true,
      roles: ['student', 'chapter_admin'],
      userId: 'chapter-user-1',
      displayName: 'Morgan Admin',
    })

    expect(screen.getByLabelText(/role view/i)).toBeInTheDocument()
  })
})
