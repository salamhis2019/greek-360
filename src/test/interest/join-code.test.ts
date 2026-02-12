import { describe, expect, it } from 'vitest'
import {
  isJoinCodeFormatValid,
  normalizeJoinCodeInput,
  parseJoinCodeOrThrow,
} from '@/features/interest/joinCode'

describe('join code parsing and validation', () => {
  it('normalizes user input by trimming separators and uppercasing', () => {
    expect(normalizeJoinCodeInput('  ab-12 34  ')).toBe('AB1234')
  })

  it('accepts valid codes and rejects invalid formats', () => {
    expect(isJoinCodeFormatValid('FALL2026')).toBe(true)
    expect(isJoinCodeFormatValid('fall2026')).toBe(true)
    expect(isJoinCodeFormatValid('A1')).toBe(false)
    expect(isJoinCodeFormatValid('ABCD_123')).toBe(false)
  })

  it('returns a normalized code when parsing valid input', () => {
    expect(parseJoinCodeOrThrow(' spring-27 ')).toBe('SPRING27')
  })

  it('throws for invalid join code values', () => {
    expect(() => parseJoinCodeOrThrow('???')).toThrowError(/join code/i)
  })
})
