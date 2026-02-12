import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/router/routePaths'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import { interestService, InterestServiceError, type ResolvedJoinCodeRecord } from './interestService'
import { normalizeJoinCodeInput } from './joinCode'

type JoinMode = 'deep-link' | 'manual'

interface JoinInterestPageProps {
  mode: JoinMode
}

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof InterestServiceError) {
    if (error.code === 'invalid_code') {
      return 'Join code must be 6-12 uppercase letters or numbers.'
    }

    if (error.code === 'inactive_code') {
      return 'This join code is inactive or unavailable.'
    }

    if (error.code === 'rate_limited') {
      return 'Too many attempts. Try again in a minute.'
    }

    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const formatCycleLabel = (resolved: ResolvedJoinCodeRecord | null) => {
  if (!resolved) {
    return ''
  }

  return `${resolved.cycleTerm} ${resolved.cycleYear}`
}

export const JoinInterestPage = ({ mode }: JoinInterestPageProps) => {
  const navigate = useNavigate()
  const params = useParams<{ code: string }>()
  const { isAuthenticated, needsOnboarding, userId } = useAuthSession()

  const joinCodeFromRoute = useMemo(() => {
    if (mode !== 'deep-link') {
      return ''
    }

    return normalizeJoinCodeInput(params.code ?? '')
  }, [mode, params.code])

  const [manualCode, setManualCode] = useState('')
  const [resolvedJoinCode, setResolvedJoinCode] = useState<ResolvedJoinCodeRecord | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const source = mode === 'deep-link' ? 'qr' : 'manual_code'

  const getCurrentCode = () => {
    if (mode === 'deep-link') {
      return joinCodeFromRoute
    }

    return normalizeJoinCodeInput(manualCode)
  }

  const resolveJoinCode = async (joinCode: string) => {
    setIsResolving(true)
    setErrorMessage(null)

    try {
      const resolved = await interestService.resolveJoinCode(joinCode)
      setResolvedJoinCode(resolved)
      return resolved
    } catch (error) {
      setResolvedJoinCode(null)
      setErrorMessage(resolveErrorMessage(error))
      throw error
    } finally {
      setIsResolving(false)
    }
  }

  useEffect(() => {
    if (mode !== 'deep-link') {
      return
    }

    if (!joinCodeFromRoute) {
      setResolvedJoinCode(null)
      setErrorMessage('Join code must be 6-12 uppercase letters or numbers.')
      return
    }

    void resolveJoinCode(joinCodeFromRoute).catch(() => undefined)
  }, [joinCodeFromRoute, mode])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const currentCode = getCurrentCode()

    if (!currentCode) {
      setResolvedJoinCode(null)
      setErrorMessage('Join code must be 6-12 uppercase letters or numbers.')
      return
    }

    setIsSubmitting(true)

    try {
      if (!isAuthenticated || needsOnboarding || !userId) {
        navigate(`/auth?redirect=${encodeURIComponent(`/join/${currentCode}`)}`)
        return
      }

      const resolved =
        resolvedJoinCode?.code === currentCode
          ? resolvedJoinCode
          : await resolveJoinCode(currentCode)

      await interestService.submitInterest({
        actorUserId: userId,
        joinCode: resolved.code,
        source,
      })

      setResolvedJoinCode(resolved)
      setIsSubmitted(true)
    } catch {
      // Error state is already handled by resolveErrorMessage.
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <section className="ui-page">
        <header className="ui-page-header">
          <p className="ui-page-brand">Greek 360</p>
          <p className="ui-page-eyebrow">Completed</p>
          <h1 className="ui-page-title">Interest submitted</h1>
          <p className="ui-page-description">
            We shared your interest with the chapter and saved your place in the current cycle.
          </p>
        </header>
        <div className="ui-panel-soft space-y-2">
          <p className="ui-meta">Organization</p>
          <p className="ui-data">{resolvedJoinCode?.organizationName}</p>
          <p className="ui-meta">Cycle: {formatCycleLabel(resolvedJoinCode)}</p>
        </div>
        <p className="mt-4 text-sm text-ui-muted">
          You shared interest in {resolvedJoinCode?.organizationName} for{' '}
          {formatCycleLabel(resolvedJoinCode)}.
        </p>
        <p className="text-sm text-ui-muted">
          We&apos;ll notify you in app when this chapter updates your status.
        </p>
        <Link
          className="ui-btn-secondary mt-2 w-auto px-5"
          to={ROUTE_PATHS.home}
        >
          Go to student home
        </Link>
      </section>
    )
  }

  return (
    <section className="ui-page">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Join flow</p>
        <h1 className="ui-page-title">Join a chapter</h1>
        <p className="ui-page-description">
          Confirm your join code and submit interest. You can join multiple chapters across cycles.
        </p>
      </header>

      <form className="space-y-5" onSubmit={submit}>
        {mode === 'manual' ? (
          <div className="space-y-2">
            <label className="ui-label" htmlFor="manual-join-code">
              Join code
            </label>
            <input
              autoCapitalize="characters"
              className="ui-input uppercase"
              id="manual-join-code"
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Enter chapter code"
              value={manualCode}
            />
          </div>
        ) : (
          <div className="ui-panel-soft">
            <p className="ui-meta uppercase tracking-[0.08em]">Join code</p>
            <p className="ui-data">{joinCodeFromRoute || 'Invalid code'}</p>
          </div>
        )}

        {resolvedJoinCode ? (
          <div className="ui-panel-soft">
            <p className="ui-meta uppercase tracking-[0.08em]">Chapter</p>
            <p className="ui-data">{resolvedJoinCode.organizationName}</p>
            <p className="ui-meta">Cycle: {formatCycleLabel(resolvedJoinCode)}</p>
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}

        <button
          className="ui-btn-primary"
          disabled={isSubmitting || isResolving}
          type="submit"
        >
          {mode === 'deep-link' ? "I'm interested" : 'Continue'}
        </button>
      </form>

      {mode === 'deep-link' ? (
        <p className="text-xs text-ui-muted">
          If this code is wrong, use{' '}
          <Link className="font-semibold text-ui-heading underline underline-offset-4" to={ROUTE_PATHS.manualCodeEntry}>
            manual code entry
          </Link>
          .
        </p>
      ) : null}
    </section>
  )
}
