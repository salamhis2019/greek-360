import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { authService } from '@/features/auth/authService'
import { privacyService } from '@/features/privacy/privacyService'
import { renderAppAtRoute } from '@/test/utils/renderAppAtRoute'

const bootstrapStudent = async (phoneNumber: string) => {
  await authService.startPhoneAuth(phoneNumber)
  const verified = await authService.verifyPhoneAuth({
    phoneNumber,
    otpCode: '123456',
  })

  await authService.upsertProfile({
    userId: verified.profile.userId,
    name: `Student ${phoneNumber.slice(-4)}`,
    email: `student-${phoneNumber.slice(-4)}@example.test`,
  })

  return verified.profile.userId
}

describe('Privacy rights security regression', () => {
  it('denies unauthenticated privacy export requests', async () => {
    await expect(
      privacyService.exportMyData({
        actorUserId: null,
        actorRoles: [],
      })
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    })
  })

  it('rate-limits repeated invalid deletion re-auth attempts', async () => {
    const studentUserId = await bootstrapStudent('+14155553111')

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        privacyService.requestMyDeletion(
          { actorUserId: studentUserId, actorRoles: ['student'] },
          { otpCode: '000000' }
        )
      ).rejects.toMatchObject({
        code: 'invalid_reauth',
      })
    }

    await expect(
      privacyService.requestMyDeletion(
        { actorUserId: studentUserId, actorRoles: ['student'] },
        { otpCode: '000000' }
      )
    ).rejects.toMatchObject({
      code: 'rate_limited',
    })
  })

  it('blocks delete-processing attempts from non super-admin actors', async () => {
    const studentUserId = await bootstrapStudent('+14155553112')
    const deletionRequest = await privacyService.requestMyDeletion(
      { actorUserId: studentUserId, actorRoles: ['student'] },
      { otpCode: '123456' }
    )

    await expect(
      privacyService.processDeletionRequest(
        { actorUserId: 'chapter-admin-security', actorRoles: ['chapter_admin'] },
        { requestId: deletionRequest.id }
      )
    ).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('redirects deleted users away from authenticated routes after processing completes', async () => {
    const studentUserId = await bootstrapStudent('+14155553113')
    const deletionRequest = await privacyService.requestMyDeletion(
      { actorUserId: studentUserId, actorRoles: ['student'] },
      { otpCode: '123456' }
    )

    await privacyService.processDeletionRequest(
      { actorUserId: 'phase8-security-super-admin', actorRoles: ['super_admin'] },
      { requestId: deletionRequest.id }
    )

    renderAppAtRoute('/home', {
      isAuthenticated: true,
      userId: studentUserId,
      displayName: 'Deleted Student',
      needsOnboarding: false,
      roles: ['student'],
    })

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })
})
