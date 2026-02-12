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
      <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-ui-heading">Interest submitted</h1>
        <p className="text-sm text-ui-muted">
          You shared interest in {resolvedJoinCode?.organizationName} for{' '}
          {formatCycleLabel(resolvedJoinCode)}.
        </p>
        <p className="text-sm text-ui-muted">We&apos;ll notify you in app when this chapter updates your status.</p>
        <Link
          className="inline-flex rounded-lg border border-ui-border px-4 py-2 text-sm font-medium text-ui-heading"
          to={ROUTE_PATHS.home}
        >
          Go to student home
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">Join a chapter</h1>
      <p className="text-sm text-ui-muted">
        Confirm your join code and submit interest. You can join multiple chapters across cycles.
      </p>

      <form className="space-y-3" onSubmit={submit}>
        {mode === 'manual' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-ui-body" htmlFor="manual-join-code">
              Join code
            </label>
            <input
              autoCapitalize="characters"
              className="w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-base"
              id="manual-join-code"
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Enter chapter code"
              value={manualCode}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-ui-border p-3">
            <p className="text-xs uppercase tracking-wide text-ui-muted">Join code</p>
            <p className="text-sm font-semibold text-ui-heading">{joinCodeFromRoute || 'Invalid code'}</p>
          </div>
        )}

        {resolvedJoinCode ? (
          <div className="rounded-lg border border-ui-border p-3">
            <p className="text-xs uppercase tracking-wide text-ui-muted">Chapter</p>
            <p className="text-sm font-semibold text-ui-heading">{resolvedJoinCode.organizationName}</p>
            <p className="text-xs text-ui-muted">Cycle: {formatCycleLabel(resolvedJoinCode)}</p>
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}

        <button
          className="w-full rounded-lg bg-ui-heading px-4 py-2 text-sm font-medium text-ui-surface disabled:opacity-60"
          disabled={isSubmitting || isResolving}
          type="submit"
        >
          {mode === 'deep-link' ? "I'm interested" : 'Continue'}
        </button>
      </form>

      {mode === 'deep-link' ? (
        <p className="text-xs text-ui-muted">
          If this code is wrong, use{' '}
          <Link className="text-ui-heading underline" to={ROUTE_PATHS.manualCodeEntry}>
            manual code entry
          </Link>
          .
        </p>
      ) : null}
    </section>
  )
}
