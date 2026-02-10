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
  })
})
