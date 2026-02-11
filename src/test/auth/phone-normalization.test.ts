import { describe, expect, it } from 'vitest'
import { normalizePhoneNumber } from '@/features/auth/phone'

describe('phone normalization', () => {
  it('normalizes common US phone input into E.164 format', () => {
    expect(normalizePhoneNumber('(415) 555-0123')).toBe('+14155550123')
  })

  it('keeps E.164 numbers unchanged when already valid', () => {
    expect(normalizePhoneNumber('+447911123456')).toBe('+447911123456')
  })

  it('normalizes 00 international prefix into + format', () => {
    expect(normalizePhoneNumber('0044 7911 123456')).toBe('+447911123456')
  })

  it('rejects invalid phone numbers', () => {
    expect(() => normalizePhoneNumber('12345')).toThrowError(/invalid phone number/i)
  })
})
