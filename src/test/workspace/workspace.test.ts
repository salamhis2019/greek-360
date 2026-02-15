import { describe, expect, it } from 'vitest'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import {
  getWorkspaceNavItems,
  resolveDefaultWorkspace,
  resolveWorkspaceFromPath,
  workspaceToDefaultPath,
} from '@/features/workspace/workspace'

describe('workspace helpers', () => {
  it('resolves default workspace by role priority', () => {
    expect(resolveDefaultWorkspace(['student'])).toBe('student')
    expect(resolveDefaultWorkspace(['student', 'chapter_admin'])).toBe('chapter_admin')
    expect(resolveDefaultWorkspace(['student', 'super_admin'])).toBe('super_admin')
    expect(resolveDefaultWorkspace(['student', 'chapter_admin', 'super_admin'])).toBe(
      'super_admin'
    )
  })

  it('maps workspace to default route path', () => {
    expect(workspaceToDefaultPath('student')).toBe(ROUTE_PATHS.home)
    expect(workspaceToDefaultPath('chapter_admin')).toBe(ROUTE_PATHS.adminHome)
    expect(workspaceToDefaultPath('super_admin')).toBe(ROUTE_PATHS.superHome)
  })

  it('returns student workspace nav items', () => {
    expect(getWorkspaceNavItems('student', ['student']).map((item) => item.href)).toEqual([
      ROUTE_PATHS.home,
      ROUTE_PATHS.manualCodeEntry,
      ROUTE_PATHS.offers,
      ROUTE_PATHS.directory,
      ROUTE_PATHS.profile,
      ROUTE_PATHS.privacySettings,
    ])
  })

  it('returns chapter-admin workspace nav items', () => {
    expect(
      getWorkspaceNavItems('chapter_admin', ['student', 'chapter_admin']).map((item) => item.href)
    ).toEqual([ROUTE_PATHS.adminHome])
  })

  it('returns super-admin workspace nav items', () => {
    expect(
      getWorkspaceNavItems('super_admin', ['student', 'super_admin']).map((item) => item.href)
    ).toEqual([
      ROUTE_PATHS.superHome,
      ROUTE_PATHS.superUniversities,
      ROUTE_PATHS.superOrganizations,
      ROUTE_PATHS.superCycles,
      ROUTE_PATHS.superAdmins,
    ])
  })

  it('resolves workspace from current path for multi-role users', () => {
    const roles = ['student', 'chapter_admin', 'super_admin'] as const

    expect(resolveWorkspaceFromPath('/home', [...roles])).toBe('student')
    expect(resolveWorkspaceFromPath('/offers', [...roles])).toBe('student')
    expect(resolveWorkspaceFromPath('/admin', [...roles])).toBe('chapter_admin')
    expect(resolveWorkspaceFromPath('/super', [...roles])).toBe('super_admin')
  })
})
