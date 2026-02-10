import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { defaultAuthSessionState, type AuthSessionState } from './session'

const AUTH_SESSION_STORAGE_KEY = 'greek360.auth.session'

interface AuthSessionContextValue extends AuthSessionState {
  setSession: (nextSession: AuthSessionState) => void
  clearSession: () => void
}

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined)

const readPersistedSession = () => {
  if (typeof window === 'undefined') {
    return defaultAuthSessionState
  }

  const rawSession = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!rawSession) {
    return defaultAuthSessionState
  }

  try {
    return JSON.parse(rawSession) as AuthSessionState
  } catch {
    return defaultAuthSessionState
  }
}

interface AuthSessionProviderProps extends PropsWithChildren {
  initialSession?: AuthSessionState
}

export const AuthSessionProvider = ({
  children,
  initialSession,
}: AuthSessionProviderProps) => {
  const [session, setSession] = useState<AuthSessionState>(
    () => initialSession ?? readPersistedSession()
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const contextValue = useMemo<AuthSessionContextValue>(
    () => ({
      ...session,
      setSession,
      clearSession: () => setSession(defaultAuthSessionState),
    }),
    [session]
  )

  return <AuthSessionContext.Provider value={contextValue}>{children}</AuthSessionContext.Provider>
}

export const useAuthSession = () => {
  const contextValue = useContext(AuthSessionContext)
  if (!contextValue) {
    throw new Error('useAuthSession must be used within AuthSessionProvider')
  }

  return contextValue
}
