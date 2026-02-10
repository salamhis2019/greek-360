import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

describe('Route authorization baseline', () => {
  it('blocks student access to chapter admin routes', () => {
    renderAppAtRoute('/admin/recruitment/org-1/cycle-1/stage-1', {
      isAuthenticated: true,
      roles: ['student'],
    })

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('blocks chapter admin access to super-admin routes', () => {
    renderAppAtRoute('/super/universities', {
      isAuthenticated: true,
      roles: ['chapter_admin'],
    })

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })
})
