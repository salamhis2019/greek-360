export type UserRole = 'student' | 'chapter_admin' | 'super_admin'

export interface AuthSessionState {
  isAuthenticated: boolean
  userId: string | null
  roles: UserRole[]
}

export const defaultAuthSessionState: AuthSessionState = {
  isAuthenticated: false,
  userId: null,
  roles: [],
}
