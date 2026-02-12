import type { OfferStatus } from '@/features/offers/offerService'

export type MessageKind = 'acceptance' | 'rejection'

export type MessageRecipientGroup =
  | 'final_yes_pending_offer'
  | 'final_no'
  | 'offer_accepted'
  | 'offer_declined'

export interface MessageTemplateInput {
  organizationId: string
  createdBy: string
  kind: MessageKind
  name: string
  subject: string
  bodyText: string
}

export interface ValidatedMessageTemplateInput extends MessageTemplateInput {}

export interface RecipientTargetingInput {
  interestEntries: Array<{
    interestEntryId: string
    userId: string
  }>
  finalDecisionsByInterestEntryId: Record<string, 'yes' | 'no' | null | undefined>
  offersByInterestEntryId: Record<string, OfferStatus | null | undefined>
}

const allowedTemplateVariables = new Set(['name', 'organization_name'])
const templateVariablePattern = /{{\s*([a-z_]+)\s*}}/g

const normalizeWhitespace = (value: string) => value.trim()

const assertTemplateVariablesSupported = (value: string) => {
  const matches = [...value.matchAll(templateVariablePattern)]
  for (const match of matches) {
    const variableName = match[1]?.trim() ?? ''
    if (!allowedTemplateVariables.has(variableName)) {
      throw new Error(`Unsupported template variable: ${variableName}.`)
    }
  }

  const removedKnownTokens = value.replace(templateVariablePattern, '')
  if (removedKnownTokens.includes('{{') || removedKnownTokens.includes('}}')) {
    throw new Error('Template variables must use the format {{ variable_name }}.')
  }
}

export const validateMessageTemplateInput = (
  input: MessageTemplateInput
): ValidatedMessageTemplateInput => {
  const name = normalizeWhitespace(input.name)
  const subject = normalizeWhitespace(input.subject)
  const bodyText = normalizeWhitespace(input.bodyText)

  if (name.length === 0) {
    throw new Error('Template name is required.')
  }

  if (subject.length === 0) {
    throw new Error('Template subject is required.')
  }

  if (bodyText.length === 0) {
    throw new Error('Template body is required.')
  }

  assertTemplateVariablesSupported(subject)
  assertTemplateVariablesSupported(bodyText)

  return {
    ...input,
    name,
    subject,
    bodyText,
  }
}

export const renderTemplateContent = (
  value: string,
  context: Record<'name' | 'organization_name', string>
) => {
  assertTemplateVariablesSupported(value)
  return value.replace(templateVariablePattern, (_match, rawVariableName: string) => {
    const variableName = rawVariableName.trim() as keyof typeof context
    return context[variableName] ?? ''
  })
}

const shouldIncludeInterestEntry = ({
  recipientGroup,
  finalDecision,
  offerStatus,
}: {
  recipientGroup: MessageRecipientGroup
  finalDecision: 'yes' | 'no' | null | undefined
  offerStatus: OfferStatus | null | undefined
}) => {
  if (recipientGroup === 'final_yes_pending_offer') {
    return finalDecision === 'yes' && offerStatus === 'pending'
  }

  if (recipientGroup === 'final_no') {
    return finalDecision === 'no'
  }

  if (recipientGroup === 'offer_accepted') {
    return offerStatus === 'accepted'
  }

  return offerStatus === 'declined'
}

export const resolveRecipientUserIdsForGroup = (
  recipientGroup: MessageRecipientGroup,
  input: RecipientTargetingInput
) => {
  const recipients = new Set<string>()

  for (const entry of input.interestEntries) {
    const finalDecision = input.finalDecisionsByInterestEntryId[entry.interestEntryId]
    const offerStatus = input.offersByInterestEntryId[entry.interestEntryId]

    if (shouldIncludeInterestEntry({ recipientGroup, finalDecision, offerStatus })) {
      recipients.add(entry.userId)
    }
  }

  return [...recipients].sort((first, second) => first.localeCompare(second))
}

const hashString = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const createMessageDedupeKey = ({
  kind,
  cycleId,
  recipientUserIds,
  subject,
  bodyText,
}: {
  kind: MessageKind
  cycleId: string
  recipientUserIds: string[]
  subject: string
  bodyText: string
}) => {
  const recipientSetHash = hashString([...recipientUserIds].sort().join(','))
  const contentHash = hashString(`${subject}\n${bodyText}`)
  return `${kind}:${cycleId}:${recipientSetHash}:${contentHash}`
}
