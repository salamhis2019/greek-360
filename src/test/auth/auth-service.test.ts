import { describe, expect, it } from 'vitest'
import { createInMemoryAuthService } from '@/features/auth/authService'

describe('in-memory auth service', () => {
  it('supports OTP challenge and verify success with first-login name capture required', async () => {
    const service = createInMemoryAuthService()

    await service.startPhoneAuth('(415) 555-0123')
    const result = await service.verifyPhoneAuth({ phoneNumber: '(415) 555-0123', otpCode: '123456' })

    expect(result.profile.phoneE164).toBe('+14155550123')
    expect(result.profile.name).toBe('')
    expect(result.requiresNameEntry).toBe(true)
  })

  it('returns invalid-otp error when verification code is incorrect', async () => {
    const service = createInMemoryAuthService()

    await service.startPhoneAuth('+14155550123')

    await expect(
      service.verifyPhoneAuth({ phoneNumber: '+14155550123', otpCode: '000000' })
    ).rejects.toMatchObject({
      code: 'invalid_otp',
      message: 'The verification code is incorrect.',
    })
  })

  it('returns expired-otp error once the OTP lifetime passes', async () => {
    let nowMs = Date.UTC(2026, 1, 11, 17, 0, 0)
    const service = createInMemoryAuthService({
      now: () => nowMs,
    })

    await service.startPhoneAuth('+14155550123')
    nowMs += 6 * 60 * 1000

    await expect(
      service.verifyPhoneAuth({ phoneNumber: '+14155550123', otpCode: '123456' })
    ).rejects.toMatchObject({
      code: 'otp_expired',
      message: 'The verification code has expired.',
    })
  })

  it('rate-limits verification after repeated invalid attempts', async () => {
    const service = createInMemoryAuthService()

    await service.startPhoneAuth('+14155550123')

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(
        service.verifyPhoneAuth({ phoneNumber: '+14155550123', otpCode: '000000' })
      ).rejects.toMatchObject({
        code: 'invalid_otp',
        message: 'The verification code is incorrect.',
      })
    }

    await expect(
      service.verifyPhoneAuth({ phoneNumber: '+14155550123', otpCode: '000000' })
    ).rejects.toMatchObject({
      code: 'rate_limited',
      message: 'Too many attempts. Try again in a minute.',
    })
  })
})
