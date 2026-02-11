export type UserRole = 'student' | 'chapter_admin' | 'super_admin'

export interface AuthSessionState {
  isAuthenticated: boolean
  userId: string | null
  phoneE164: string | null
  displayName: string | null
  needsOnboarding: boolean
  roles: UserRole[]
}

export const defaultAuthSessionState: AuthSessionState = {
  isAuthenticated: false,
  userId: null,
  phoneE164: null,
  displayName: null,
  needsOnboarding: false,
  roles: [],
}
