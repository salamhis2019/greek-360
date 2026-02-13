import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionProvider'
import {
  recruitmentService,
  RecruitmentServiceError,
  type RecruitmentActor,
  type RecruitmentCandidateRecord,
} from './recruitmentService'
import { RecruitmentAdminNav } from './RecruitmentAdminNav'

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof RecruitmentServiceError) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const formatCreatedAt = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

export const RecruitmentStage1Page = () => {
  const params = useParams<{ orgId: string; cycleId: string }>()
  const organizationId = params.orgId ?? ''
  const cycleId = params.cycleId ?? ''
  const hasRouteParams = Boolean(organizationId && cycleId)

  const { userId, roles } = useAuthSession()
  const actor = useMemo<RecruitmentActor>(
    () => ({
      actorUserId: userId,
      actorRoles: roles,
    }),
    [roles, userId]
  )

  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stage1QueryKey = ['recruitment', 'stage1', organizationId, cycleId, actor.actorUserId]
  const stage2QueryKey = ['recruitment', 'stage2', organizationId, cycleId, actor.actorUserId]

  const stage1QueueQuery = useQuery({
    queryKey: stage1QueryKey,
    enabled: hasRouteParams,
    queryFn: () => recruitmentService.listStage1Queue(actor, { organizationId, cycleId }),
  })

  const stage1DecisionMutation = useMutation({
    mutationFn: ({
      interestEntryId,
      decision,
    }: {
      interestEntryId: string
      decision: 'yes' | 'no'
    }) => recruitmentService.submitStage1Decision(actor, { interestEntryId, decision }),
    onMutate: async ({ interestEntryId }) => {
      setErrorMessage(null)
      await queryClient.cancelQueries({ queryKey: stage1QueryKey })

      const previousQueue = queryClient.getQueryData<RecruitmentCandidateRecord[]>(stage1QueryKey)
      queryClient.setQueryData<RecruitmentCandidateRecord[]>(stage1QueryKey, (queue = []) =>
        queue.filter((candidate) => candidate.interestEntryId !== interestEntryId)
      )

      return { previousQueue }
    },
    onError: (error, _variables, context) => {
      if (context?.previousQueue) {
        queryClient.setQueryData(stage1QueryKey, context.previousQueue)
      }

      setErrorMessage(resolveErrorMessage(error))
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: stage1QueryKey })
      await queryClient.invalidateQueries({ queryKey: stage2QueryKey })
    },
  })

  const queue = stage1QueueQuery.data ?? []

  if (!hasRouteParams) {
    return (
      <section className="ui-page-admin">
        <header className="ui-page-header">
          <p className="ui-page-brand">Greek 360</p>
          <p className="ui-page-eyebrow">Recruitment</p>
          <h1 className="ui-page-title">Stage 1 queue</h1>
        </header>
        <p className="text-sm font-medium text-red-700">
          Organization and cycle identifiers are required for this route.
        </p>
      </section>
    )
  }

  return (
    <section className="ui-page-admin space-y-4">
      <header className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <p className="ui-page-eyebrow">Recruitment</p>
        <h1 className="ui-page-title">Stage 1 queue</h1>
        <p className="ui-page-description">Review incoming interest and decide shortlist or no with one tap.</p>
      </header>
      <RecruitmentAdminNav cycleId={cycleId} organizationId={organizationId} />

      {stage1QueueQuery.isLoading ? <p className="text-sm text-ui-muted">Loading candidates...</p> : null}
      {stage1QueueQuery.isError ? (
        <p className="text-sm font-medium text-red-700">{resolveErrorMessage(stage1QueueQuery.error)}</p>
      ) : null}
      {errorMessage ? <p className="text-sm font-medium text-red-700">{errorMessage}</p> : null}

      {queue.length === 0 && !stage1QueueQuery.isLoading ? (
        <p className="text-sm text-ui-muted">Stage 1 queue is clear.</p>
      ) : null}

      <ul className="space-y-3">
        {queue.map((candidate) => (
          <li className="ui-panel space-y-3" key={candidate.interestEntryId}>
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-ui-heading">{candidate.userId}</p>
              <p className="ui-meta">
                Source: {candidate.source} | Submitted: {formatCreatedAt(candidate.createdAt)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="ui-btn-primary min-h-[2.9rem]"
                onClick={() =>
                  stage1DecisionMutation.mutate({
                    interestEntryId: candidate.interestEntryId,
                    decision: 'yes',
                  })
                }
                type="button"
              >
                Shortlist
              </button>
              <button
                className="ui-btn-secondary min-h-[2.9rem]"
                onClick={() =>
                  stage1DecisionMutation.mutate({
                    interestEntryId: candidate.interestEntryId,
                    decision: 'no',
                  })
                }
                type="button"
              >
                No
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
