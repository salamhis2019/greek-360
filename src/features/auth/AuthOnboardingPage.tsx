import { FormEvent, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import { authService, AuthServiceError } from './authService'
import { useAuthSession } from './AuthSessionProvider'

type AuthStep = 'phone' | 'otp' | 'profile'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof AuthServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export const AuthOnboardingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, userId, needsOnboarding, displayName, setSession } = useAuthSession()

  const postAuthRedirectPath = useMemo(() => {
    const redirectPath = new URLSearchParams(location.search).get('redirect')

    if (!redirectPath || !redirectPath.startsWith('/')) {
      return ROUTE_PATHS.home
    }

    if (redirectPath.startsWith('//') || redirectPath.startsWith('/auth')) {
      return ROUTE_PATHS.home
    }

    return redirectPath
  }, [location.search])

  const initialStep: AuthStep = useMemo(() => {
    if (isAuthenticated && needsOnboarding) {
      return 'profile'
    }

    return 'phone'
  }, [isAuthenticated, needsOnboarding])

  const [step, setStep] = useState<AuthStep>(initialStep)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [profileName, setProfileName] = useState(displayName ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submitPhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await authService.startPhoneAuth(phoneNumber)
      setPhoneNumber(result.phoneE164)
      setStep('otp')
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await authService.verifyPhoneAuth({
        phoneNumber,
        otpCode: verificationCode,
      })

      setSession({
        isAuthenticated: true,
        userId: result.profile.userId,
        phoneE164: result.profile.phoneE164,
        displayName: result.profile.name || null,
        needsOnboarding: result.requiresNameEntry,
        roles: result.roles,
      })

      if (result.requiresNameEntry) {
        setProfileName(result.profile.name)
        setStep('profile')
        return
      }

      navigate(postAuthRedirectPath)
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      setErrorMessage('Your session is missing required user information. Sign in again.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await authService.upsertProfile({
        userId,
        name: profileName,
      })

      setSession({
        isAuthenticated: true,
        userId: result.userId,
        phoneE164: result.phoneE164,
        displayName: result.name,
        needsOnboarding: false,
        roles: ['student'],
      })

      navigate(postAuthRedirectPath)
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (step === 'otp') {
    return (
      <section className="mx-auto w-full max-w-md rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-ui-heading">Verify your code</h1>
        <p className="mt-2 text-sm text-ui-muted">Enter the 6-digit code sent to your phone.</p>
        <p className="mt-1 text-xs text-ui-muted">For local development, use code 123456.</p>
        <form className="mt-4 space-y-4" onSubmit={submitOtp}>
          <label className="block text-sm font-medium text-ui-body" htmlFor="otp-code">
            Verification code
          </label>
          <input
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="otp-code"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setVerificationCode(event.target.value)}
            value={verificationCode}
          />
          {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
          <button
            className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            Verify code
          </button>
        </form>
      </section>
    )
  }

  if (step === 'profile') {
    return (
      <section className="mx-auto w-full max-w-md rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-ui-heading">Complete your profile</h1>
        <p className="mt-2 text-sm text-ui-muted">Add your display name so chapters can identify you.</p>
        <form className="mt-4 space-y-4" onSubmit={submitProfile}>
          <label className="block text-sm font-medium text-ui-body" htmlFor="display-name">
            Display name
          </label>
          <input
            autoComplete="name"
            className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
            id="display-name"
            onChange={(event) => setProfileName(event.target.value)}
            value={profileName}
          />
          {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
          <button
            className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            Continue
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Sign in</h1>
      <p className="mt-2 text-sm text-ui-muted">Enter your phone number to get a verification code.</p>
      <form className="mt-4 space-y-4" onSubmit={submitPhone}>
        <label className="block text-sm font-medium text-ui-body" htmlFor="phone-number">
          Phone number
        </label>
        <input
          autoComplete="tel"
          className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
          id="phone-number"
          inputMode="tel"
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="(555) 123-4567"
          value={phoneNumber}
        />
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          Send code
        </button>
      </form>
    </section>
  )
}
