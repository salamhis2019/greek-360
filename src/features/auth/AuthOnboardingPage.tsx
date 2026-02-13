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
  const { isAuthenticated, userId, needsOnboarding, displayName, roles, setSession } =
    useAuthSession()

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
  const authFontStack =
    "'SF Pro Display', 'SF Pro Text', 'Avenir Next', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

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
        roles: roles.length > 0 ? roles : ['student'],
      })

      navigate(postAuthRedirectPath)
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepContent =
    step === 'otp'
      ? {
          eyebrow: 'Step 2 of 3',
          title: 'Verify your code',
          description: 'Enter the 6-digit code sent to your phone.',
          helper: 'For local development, use code 123456.',
        }
      : step === 'profile'
        ? {
            eyebrow: 'Step 3 of 3',
            title: 'Complete your profile',
            description: 'Add your display name so chapters can identify you.',
            helper: null,
          }
        : {
            eyebrow: 'Step 1 of 3',
            title: 'Sign in',
            description: 'Enter your phone number to get a verification code.',
            helper: null,
          }

  if (step === 'otp') {
    return (
      <section
        className="mx-auto w-full max-w-[30rem] px-1 py-8 sm:py-12"
        style={{ fontFamily: authFontStack }}
      >
        <div className="mb-7 border-b border-black/10 pb-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-black/35">Greek 360</p>
          <p className="text-[0.69rem] font-semibold uppercase tracking-[0.2em] text-black/45">
            {stepContent.eyebrow}
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-black">
            {stepContent.title}
          </h1>
          <p className="mt-2 text-[0.97rem] leading-relaxed text-black/65">{stepContent.description}</p>
          {stepContent.helper ? (
            <p className="mt-2 text-[0.78rem] font-medium uppercase tracking-[0.08em] text-black/45">
              {stepContent.helper}
            </p>
          ) : null}
        </div>
        <form className="space-y-5" onSubmit={submitOtp}>
          <label
            className="block text-[0.78rem] font-semibold uppercase tracking-[0.09em] text-black/50"
            htmlFor="otp-code"
          >
            Verification code
          </label>
          <input
            autoComplete="one-time-code"
            className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-[1.08rem] font-medium text-black outline-none transition focus:border-black/25 focus:ring-4 focus:ring-black/10"
            id="otp-code"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setVerificationCode(event.target.value)}
            value={verificationCode}
          />
          {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
          <button
            className="h-12 w-full rounded-full bg-black px-4 text-[0.95rem] font-semibold tracking-[0.01em] text-white transition hover:bg-black/90 disabled:opacity-50"
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
      <section
        className="mx-auto w-full max-w-[30rem] px-1 py-8 sm:py-12"
        style={{ fontFamily: authFontStack }}
      >
        <div className="mb-7 border-b border-black/10 pb-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-black/35">Greek 360</p>
          <p className="text-[0.69rem] font-semibold uppercase tracking-[0.2em] text-black/45">
            {stepContent.eyebrow}
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-black">
            {stepContent.title}
          </h1>
          <p className="mt-2 text-[0.97rem] leading-relaxed text-black/65">{stepContent.description}</p>
        </div>
        <form className="space-y-5" onSubmit={submitProfile}>
          <label
            className="block text-[0.78rem] font-semibold uppercase tracking-[0.09em] text-black/50"
            htmlFor="display-name"
          >
            Display name
          </label>
          <input
            autoComplete="name"
            className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-[1.08rem] font-medium text-black outline-none transition focus:border-black/25 focus:ring-4 focus:ring-black/10"
            id="display-name"
            onChange={(event) => setProfileName(event.target.value)}
            value={profileName}
          />
          {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
          <button
            className="h-12 w-full rounded-full bg-black px-4 text-[0.95rem] font-semibold tracking-[0.01em] text-white transition hover:bg-black/90 disabled:opacity-50"
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
    <section
      className="mx-auto w-full max-w-[30rem] px-1 py-8 sm:py-12"
      style={{ fontFamily: authFontStack }}
    >
      <div className="mb-7 border-b border-black/10 pb-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-black/35">Greek 360</p>
        <p className="text-[0.69rem] font-semibold uppercase tracking-[0.2em] text-black/45">
          {stepContent.eyebrow}
        </p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-black">
          {stepContent.title}
        </h1>
        <p className="mt-2 text-[0.97rem] leading-relaxed text-black/65">{stepContent.description}</p>
      </div>
      <form className="space-y-5" onSubmit={submitPhone}>
        <label
          className="block text-[0.78rem] font-semibold uppercase tracking-[0.09em] text-black/50"
          htmlFor="phone-number"
        >
          Phone number
        </label>
        <input
          autoComplete="tel"
          className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-[1.08rem] font-medium text-black outline-none transition focus:border-black/25 focus:ring-4 focus:ring-black/10"
          id="phone-number"
          inputMode="tel"
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="(555) 123-4567"
          value={phoneNumber}
        />
        {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
        <button
          className="h-12 w-full rounded-full bg-black px-4 text-[0.95rem] font-semibold tracking-[0.01em] text-white transition hover:bg-black/90 disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          Send code
        </button>
      </form>
    </section>
  )
}
