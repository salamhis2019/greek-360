import { describe, expect, it } from 'vitest'
import {
  createMessageDedupeKey,
  renderTemplateContent,
  resolveRecipientUserIdsForGroup,
  validateMessageTemplateInput,
} from '@/features/messaging/messagingLogic'

describe('Messaging template validation and rendering', () => {
  it('requires template name, subject, and body text', () => {
    expect(() =>
      validateMessageTemplateInput({
        organizationId: 'org-1',
        createdBy: 'admin-1',
        kind: 'acceptance',
        name: ' ',
        subject: 'Welcome',
        bodyText: 'Body',
      })
    ).toThrow(/name/i)

    expect(() =>
      validateMessageTemplateInput({
        organizationId: 'org-1',
        createdBy: 'admin-1',
        kind: 'acceptance',
        name: 'Template',
        subject: ' ',
        bodyText: 'Body',
      })
    ).toThrow(/subject/i)

    expect(() =>
      validateMessageTemplateInput({
        organizationId: 'org-1',
        createdBy: 'admin-1',
        kind: 'acceptance',
        name: 'Template',
        subject: 'Welcome',
        bodyText: ' ',
      })
    ).toThrow(/body/i)
  })

  it('rejects unsupported template variables and renders supported variables', () => {
    expect(() =>
      validateMessageTemplateInput({
        organizationId: 'org-1',
        createdBy: 'admin-1',
        kind: 'acceptance',
        name: 'Template',
        subject: 'Welcome {{ favorite_color }}',
        bodyText: 'Body',
      })
    ).toThrow(/variable/i)

    const rendered = renderTemplateContent('Hi {{ name }} from {{ organization_name }}', {
      name: 'Ari Student',
      organization_name: 'Alpha House',
    })

    expect(rendered).toBe('Hi Ari Student from Alpha House')
  })
})

describe('Messaging recipient targeting and dedupe keys', () => {
  const targetingInput = {
    interestEntries: [
      { interestEntryId: 'ie-1', userId: 'user-1' },
      { interestEntryId: 'ie-2', userId: 'user-2' },
      { interestEntryId: 'ie-3', userId: 'user-3' },
      { interestEntryId: 'ie-4', userId: 'user-4' },
    ],
    finalDecisionsByInterestEntryId: {
      'ie-1': 'yes',
      'ie-2': 'no',
      'ie-3': 'yes',
      'ie-4': 'yes',
    } as const,
    offersByInterestEntryId: {
      'ie-1': 'pending',
      'ie-2': null,
      'ie-3': 'accepted',
      'ie-4': 'declined',
    } as const,
  }

  it('targets each recipient group correctly', () => {
    expect(
      resolveRecipientUserIdsForGroup('final_yes_pending_offer', targetingInput)
    ).toEqual(['user-1'])

    expect(resolveRecipientUserIdsForGroup('final_no', targetingInput)).toEqual(['user-2'])

    expect(resolveRecipientUserIdsForGroup('offer_accepted', targetingInput)).toEqual([
      'user-3',
    ])

    expect(resolveRecipientUserIdsForGroup('offer_declined', targetingInput)).toEqual([
      'user-4',
    ])
  })

  it('builds a stable dedupe key independent of recipient ordering', () => {
    const first = createMessageDedupeKey({
      kind: 'acceptance',
      cycleId: 'cycle-1',
      recipientUserIds: ['user-3', 'user-1'],
      subject: 'Welcome',
      bodyText: 'You are accepted',
    })

    const second = createMessageDedupeKey({
      kind: 'acceptance',
      cycleId: 'cycle-1',
      recipientUserIds: ['user-1', 'user-3'],
      subject: 'Welcome',
      bodyText: 'You are accepted',
    })

    const changedContent = createMessageDedupeKey({
      kind: 'acceptance',
      cycleId: 'cycle-1',
      recipientUserIds: ['user-1', 'user-3'],
      subject: 'Welcome',
      bodyText: 'You are accepted to Alpha House',
    })

    expect(first).toBe(second)
    expect(changedContent).not.toBe(first)
  })
})
