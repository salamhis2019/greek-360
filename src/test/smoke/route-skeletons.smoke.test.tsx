import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import type { AuthSessionState } from '@/features/auth/session'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const studentSession: Partial<AuthSessionState> = {
  isAuthenticated: true,
  roles: ['student'],
}

const chapterAdminSession: Partial<AuthSessionState> = {
  isAuthenticated: true,
  roles: ['chapter_admin'],
}

const superAdminSession: Partial<AuthSessionState> = {
  isAuthenticated: true,
  roles: ['super_admin'],
}

describe('Route skeleton coverage', () => {
  it.each([
    { path: '/auth', heading: /sign in/i, session: {} },
    { path: '/join/code-1', heading: /join a chapter/i, session: {} },
    { path: '/code', heading: /join a chapter/i, session: {} },
    { path: '/home', heading: /student home/i, session: studentSession },
    { path: '/offers', heading: /offers/i, session: studentSession },
    { path: '/directory', heading: /directory/i, session: studentSession },
    { path: '/profile', heading: /profile/i, session: studentSession },
    { path: '/settings/privacy', heading: /privacy settings/i, session: studentSession },
    {
      path: '/admin',
      heading: /admin dashboard/i,
      session: chapterAdminSession,
    },
    {
      path: '/admin/recruitment/org-1/cycle-1/stage-2',
      heading: /stage 2 decisions/i,
      session: chapterAdminSession,
    },
    {
      path: '/admin/recruitment/org-1/cycle-1/messages',
      heading: /messages/i,
      session: chapterAdminSession,
    },
    {
      path: '/admin/members/org-1',
      heading: /members/i,
      session: chapterAdminSession,
    },
    {
      path: '/super',
      heading: /super-admin dashboard/i,
      session: superAdminSession,
    },
    {
      path: '/super/universities',
      heading: /universities/i,
      session: superAdminSession,
    },
    {
      path: '/super/organizations',
      heading: /organizations/i,
      session: superAdminSession,
    },
    {
      path: '/super/admins',
      heading: /admin assignments/i,
      session: superAdminSession,
    },
    {
      path: '/super/cycles',
      heading: /recruitment cycles/i,
      session: superAdminSession,
    },
    { path: '/does-not-exist', heading: /not found/i, session: {} },
  ])('renders $path', async ({ path, heading, session }) => {
    renderAppAtRoute(path, session)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })
})
