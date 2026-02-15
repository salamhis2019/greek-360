import type { SupabaseClient } from '@supabase/supabase-js'
import { environment } from '@/lib/env'
import { isUserDeleted } from '@/features/privacy/privacyDeletionState'
import { supabase } from '@/lib/supabase/client'
import { normalizePhoneNumber } from './phone'
import type { UserRole } from './session'

export type AuthServiceErrorCode =
  | 'invalid_phone'
  | 'invalid_otp'
  | 'otp_expired'
  | 'rate_limited'
  | 'invalid_profile'
  | 'unknown'

export class AuthServiceError extends Error {
  code: AuthServiceErrorCode

  constructor(code: AuthServiceErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface UserProfileRecord {
  userId: string
  phoneE164: string
  name: string
  email: string | null
}

export interface StartPhoneAuthResult {
  phoneE164: string
}

export interface VerifyPhoneAuthParams {
  phoneNumber: string
  otpCode: string
}

export interface VerifyPhoneAuthResult {
  profile: UserProfileRecord
  roles: UserRole[]
  requiresNameEntry: boolean
}

export interface UpsertProfileParams {
  userId: string
  name: string
  email?: string | null
}

export interface AuthService {
  startPhoneAuth: (phoneNumber: string) => Promise<StartPhoneAuthResult>
  verifyPhoneAuth: (params: VerifyPhoneAuthParams) => Promise<VerifyPhoneAuthResult>
  upsertProfile: (params: UpsertProfileParams) => Promise<UserProfileRecord>
  signOut: () => Promise<void>
}

interface ResettableAuthService extends AuthService {
  resetForTests: () => void
  listProfilesForDirectory?: () => Promise<UserProfileRecord[]>
}

interface InMemoryChallenge {
  otpCode: string
  expiresAt: number
  failedAttempts: number
  lockedUntil: number | null
}

interface InMemoryAuthServiceOptions {
  now?: () => number
}

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_FAILED_ATTEMPTS = 5
const OTP_LOCK_MS = 60 * 1000
const OTP_DEV_CODE = '123456'

export const resolveUserRoles = ({
  isSuperAdmin,
  isChapterAdmin,
}: {
  isSuperAdmin: boolean
  isChapterAdmin: boolean
}): UserRole[] => {
  const roles: UserRole[] = ['student']

  if (isChapterAdmin) {
    roles.push('chapter_admin')
  }

  if (isSuperAdmin) {
    roles.push('super_admin')
  }

  return roles
}

const normalizeOrThrow = (phoneNumber: string) => {
  try {
    return normalizePhoneNumber(phoneNumber)
  } catch {
    throw new AuthServiceError('invalid_phone', 'Please enter a valid phone number.')
  }
}

const mapUnknownErrorToAuthServiceError = (error: unknown): AuthServiceError => {
  if (error instanceof AuthServiceError) {
    return error
  }

  return new AuthServiceError('unknown', 'Something went wrong. Please try again.')
}

const resolveErrorCodeFromMessage = (message: string): AuthServiceErrorCode => {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('rate')) {
    return 'rate_limited'
  }

  if (normalizedMessage.includes('expired')) {
    return 'otp_expired'
  }

  if (normalizedMessage.includes('invalid') && normalizedMessage.includes('otp')) {
    return 'invalid_otp'
  }

  if (normalizedMessage.includes('phone')) {
    return 'invalid_phone'
  }

  return 'unknown'
}

const createMockUserId = (phoneE164: string) => {
  const digits = phoneE164.replace(/\D/g, '')
  return `mock-user-${digits.slice(-12)}`
}

const useInMemoryAuth =
  import.meta.env.MODE === 'test' ||
  environment.supabasePublishableKey === 'placeholder-publishable-key' ||
  environment.supabaseUrl.includes('placeholder-project-ref')

export const createInMemoryAuthService = (
  options: InMemoryAuthServiceOptions = {}
): ResettableAuthService => {
  const now = options.now ?? (() => Date.now())
  const challengesByPhone = new Map<string, InMemoryChallenge>()
  const profilesByPhone = new Map<string, UserProfileRecord>()
  const profilesByUserId = new Map<string, UserProfileRecord>()

  const ensureProfile = (phoneE164: string) => {
    const existing = profilesByPhone.get(phoneE164)
    if (existing) {
      return existing
    }

    const createdProfile: UserProfileRecord = {
      userId: createMockUserId(phoneE164),
      phoneE164,
      name: '',
      email: null,
    }

    profilesByPhone.set(phoneE164, createdProfile)
    profilesByUserId.set(createdProfile.userId, createdProfile)

    return createdProfile
  }

  return {
    async startPhoneAuth(phoneNumber) {
      const phoneE164 = normalizeOrThrow(phoneNumber)
      const existingChallenge = challengesByPhone.get(phoneE164)

      if (existingChallenge?.lockedUntil && existingChallenge.lockedUntil > now()) {
        throw new AuthServiceError('rate_limited', 'Too many attempts. Try again in a minute.')
      }

      challengesByPhone.set(phoneE164, {
        otpCode: OTP_DEV_CODE,
        expiresAt: now() + OTP_TTL_MS,
        failedAttempts: 0,
        lockedUntil: null,
      })

      ensureProfile(phoneE164)
      return { phoneE164 }
    },

    async verifyPhoneAuth({ phoneNumber, otpCode }) {
      const phoneE164 = normalizeOrThrow(phoneNumber)
      const challenge = challengesByPhone.get(phoneE164)

      if (!challenge) {
        throw new AuthServiceError('otp_expired', 'The verification code has expired.')
      }

      if (challenge.lockedUntil && challenge.lockedUntil > now()) {
        throw new AuthServiceError('rate_limited', 'Too many attempts. Try again in a minute.')
      }

      if (challenge.expiresAt < now()) {
        challengesByPhone.delete(phoneE164)
        throw new AuthServiceError('otp_expired', 'The verification code has expired.')
      }

      if (otpCode.trim() !== challenge.otpCode) {
        challenge.failedAttempts += 1

        if (challenge.failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
          challenge.lockedUntil = now() + OTP_LOCK_MS
          throw new AuthServiceError('rate_limited', 'Too many attempts. Try again in a minute.')
        }

        throw new AuthServiceError('invalid_otp', 'The verification code is incorrect.')
      }

      challengesByPhone.delete(phoneE164)
      const profile = ensureProfile(phoneE164)
      if (isUserDeleted(profile.userId)) {
        throw new AuthServiceError('unknown', 'This account has been deleted.')
      }

      return {
        profile,
        roles: resolveUserRoles({
          isSuperAdmin: false,
          isChapterAdmin: false,
        }),
        requiresNameEntry: profile.name.trim().length === 0,
      }
    },

    async upsertProfile({ userId, name, email }) {
      const trimmedName = name.trim()
      if (trimmedName.length < 2) {
        throw new AuthServiceError('invalid_profile', 'Display name must be at least 2 characters.')
      }

      const existingProfile = profilesByUserId.get(userId)
      if (!existingProfile) {
        throw new AuthServiceError('unknown', 'Unable to find user profile.')
      }

      if (isUserDeleted(userId)) {
        throw new AuthServiceError('unknown', 'This account has been deleted.')
      }

      const updatedProfile = {
        ...existingProfile,
        name: trimmedName,
        email: email ?? existingProfile.email,
      }

      profilesByUserId.set(userId, updatedProfile)
      profilesByPhone.set(updatedProfile.phoneE164, updatedProfile)

      return updatedProfile
    },

    async signOut() {
      return
    },

    async listProfilesForDirectory() {
      return [...profilesByUserId.values()].filter((profile) => !isUserDeleted(profile.userId))
    },

    resetForTests() {
      challengesByPhone.clear()
      profilesByPhone.clear()
      profilesByUserId.clear()
    },
  }
}

const createSupabaseAuthService = (client: SupabaseClient): AuthService => ({
  async startPhoneAuth(phoneNumber) {
    const phoneE164 = normalizeOrThrow(phoneNumber)

    const { error } = await client.auth.signInWithOtp({ phone: phoneE164 })

    if (error) {
      const errorCode = resolveErrorCodeFromMessage(error.message)
      throw new AuthServiceError(errorCode, error.message)
    }

    return { phoneE164 }
  },

  async verifyPhoneAuth({ phoneNumber, otpCode }) {
    const phoneE164 = normalizeOrThrow(phoneNumber)

    const { data, error } = await client.auth.verifyOtp({
      phone: phoneE164,
      token: otpCode.trim(),
      type: 'sms',
    })

    if (error) {
      const errorCode = resolveErrorCodeFromMessage(error.message)
      throw new AuthServiceError(errorCode, error.message)
    }

    const authenticatedUser = data.user
    if (!authenticatedUser) {
      throw new AuthServiceError('unknown', 'Unexpected verification response.')
    }

    const { data: profile, error: profileError } = await client
      .from('users')
      .select('id, phone_e164, name, email, deleted_at')
      .eq('id', authenticatedUser.id)
      .single()

    if (profileError) {
      throw new AuthServiceError('unknown', profileError.message)
    }

    if (profile.deleted_at) {
      throw new AuthServiceError('unknown', 'This account has been deleted.')
    }

    let isSuperAdmin = false
    let isChapterAdmin = false

    const { data: superAdminFlag, error: superAdminFlagError } = await client.rpc(
      'current_user_is_super_admin'
    )

    if (!superAdminFlagError) {
      isSuperAdmin = Boolean(superAdminFlag)
    } else {
      const { data: superAdminRecord, error: superAdminLookupError } = await client
        .from('super_admin_users')
        .select('user_id')
        .eq('user_id', authenticatedUser.id)
        .maybeSingle()

      if (!superAdminLookupError) {
        isSuperAdmin = Boolean(superAdminRecord)
      }
    }

    const { data: chapterAdminAssignments, error: chapterAdminError } = await client
      .from('organization_admins')
      .select('organization_id')
      .eq('user_id', authenticatedUser.id)
      .limit(1)

    if (!chapterAdminError) {
      isChapterAdmin = (chapterAdminAssignments ?? []).length > 0
    }

    return {
      profile: {
        userId: profile.id as string,
        phoneE164: (profile.phone_e164 as string) ?? phoneE164,
        name: (profile.name as string) ?? '',
        email: (profile.email as string | null) ?? null,
      },
      roles: resolveUserRoles({
        isSuperAdmin,
        isChapterAdmin,
      }),
      requiresNameEntry: ((profile.name as string) ?? '').trim().length === 0,
    }
  },

  async upsertProfile({ userId, name, email }) {
    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      throw new AuthServiceError('invalid_profile', 'Display name must be at least 2 characters.')
    }

    const { data, error } = await client.rpc('upsert_profile', {
      profile_name: trimmedName,
      profile_email: email ?? null,
    })

    if (error) {
      const errorCode = resolveErrorCodeFromMessage(error.message)
      throw new AuthServiceError(errorCode, error.message)
    }

    const record = data as {
      id?: string
      phone_e164?: string
      name?: string
      email?: string | null
    }

    return {
      userId: record.id ?? userId,
      phoneE164: record.phone_e164 ?? '',
      name: record.name ?? trimmedName,
      email: record.email ?? null,
    }
  },

  async signOut() {
    const { error } = await client.auth.signOut()

    if (error) {
      throw new AuthServiceError(resolveErrorCodeFromMessage(error.message), error.message)
    }
  },
})

const sharedAuthService = useInMemoryAuth
  ? createInMemoryAuthService()
  : createSupabaseAuthService(supabase)

export const resetAuthServiceForTests = () => {
  if (
    'resetForTests' in sharedAuthService &&
    typeof sharedAuthService.resetForTests === 'function'
  ) {
    sharedAuthService.resetForTests()
  }
}

export const listProfilesForDirectory = async (): Promise<UserProfileRecord[]> => {
  if (
    'listProfilesForDirectory' in sharedAuthService &&
    typeof sharedAuthService.listProfilesForDirectory === 'function'
  ) {
    return sharedAuthService.listProfilesForDirectory()
  }

  return []
}

export const authService: AuthService = {
  async startPhoneAuth(phoneNumber) {
    try {
      return await sharedAuthService.startPhoneAuth(phoneNumber)
    } catch (error) {
      throw mapUnknownErrorToAuthServiceError(error)
    }
  },

  async verifyPhoneAuth(params) {
    try {
      return await sharedAuthService.verifyPhoneAuth(params)
    } catch (error) {
      throw mapUnknownErrorToAuthServiceError(error)
    }
  },

  async upsertProfile(params) {
    try {
      return await sharedAuthService.upsertProfile(params)
    } catch (error) {
      throw mapUnknownErrorToAuthServiceError(error)
    }
  },

  async signOut() {
    try {
      return await sharedAuthService.signOut()
    } catch (error) {
      throw mapUnknownErrorToAuthServiceError(error)
    }
  },
}
