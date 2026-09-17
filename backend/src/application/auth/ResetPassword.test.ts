import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { ResetPassword } from './ResetPassword.js'
import { AppError } from '../../domain/shared/AppError.js'
import { Identity } from '../../domain/auth/Identity.js'
import { VerificationToken } from '../../domain/auth/VerificationToken.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IVerificationTokenRepository } from '../../domain/auth/IVerificationTokenRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type VerificationTokenOverrides = {
  purpose?: 'email_confirmation' | 'password_reset'
  expiresAt?: Date
  consumedAt?: Date | null
}

const buildToken = (
  overrides: VerificationTokenOverrides = {},
): VerificationToken =>
  new VerificationToken(
    'token-1',
    'user-1',
    overrides.purpose ?? 'password_reset',
    'hashed-token',
    overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    overrides.consumedAt ?? null,
    new Date(),
  )

describe('ResetPassword', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let verificationTokenRepository: jest.Mocked<IVerificationTokenRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let resetPassword: ResetPassword

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' }

  beforeEach(() => {
    identityRepository = {
      save: jest.fn<IIdentityRepository['save']>(),
      findByProviderAndProviderId: jest.fn<IIdentityRepository['findByProviderAndProviderId']>(),
      findByUserIdAndProvider: jest.fn<IIdentityRepository['findByUserIdAndProvider']>(),
      updatePasswordHash: jest.fn<IIdentityRepository['updatePasswordHash']>(),
    }
    sessionRepository = {
      save: jest.fn<ISessionRepository['save']>(),
      findByRefreshTokenHash: jest.fn<ISessionRepository['findByRefreshTokenHash']>(),
      updateRefreshTokenHash: jest.fn<ISessionRepository['updateRefreshTokenHash']>(),
      delete: jest.fn<ISessionRepository['delete']>(),
      deleteAllByUserId: jest.fn<ISessionRepository['deleteAllByUserId']>(),
    }
    verificationTokenRepository = {
      save: jest.fn<IVerificationTokenRepository['save']>(),
      findByTokenHash: jest.fn<IVerificationTokenRepository['findByTokenHash']>(),
      markConsumed: jest.fn<IVerificationTokenRepository['markConsumed']>(),
      deleteActiveByUserIdAndPurpose: jest.fn<IVerificationTokenRepository['deleteActiveByUserIdAndPurpose']>(),
    }
    auditLogRepository = {
      save: jest.fn<IAuditLogRepository['save']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>

    resetPassword = new ResetPassword(
      identityRepository,
      sessionRepository,
      verificationTokenRepository,
      auditLogRepository,
      jwtService,
    )
  })

  it('① 成功: パスワード更新・トークン使用済み化・全セッション削除・監査ログ(success)', async () => {
    jwtService.hashToken.mockReturnValue('hashed-token')
    verificationTokenRepository.findByTokenHash.mockResolvedValue(buildToken())
    identityRepository.findByUserIdAndProvider.mockResolvedValue(
      new Identity('identity-1', 'user-1', 'email', 'test@example.com', 'old-hash', new Date()),
    )

    await resetPassword.execute('raw-token', 'new-password123', ctx)

    expect(identityRepository.updatePasswordHash).toHaveBeenCalledTimes(1)
    expect(identityRepository.updatePasswordHash.mock.calls[0][0]).toBe('identity-1')

    expect(verificationTokenRepository.markConsumed).toHaveBeenCalledWith('token-1', expect.any(Date))
    expect(sessionRepository.deleteAllByUserId).toHaveBeenCalledWith('user-1')

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.action).toBe('auth.password_reset.confirm')
    expect(savedLog.result).toBe('success')
  })

  it('② トークンが存在しない: AppError(400)、監査ログ(failure, token_not_found)', async () => {
    verificationTokenRepository.findByTokenHash.mockResolvedValue(null)

    expect.assertions(4)
    try {
      await resetPassword.execute('raw-token', 'new-password123', ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.metadata).toEqual({ reason: 'token_not_found' })
    expect(identityRepository.updatePasswordHash).not.toHaveBeenCalled()
  })

  it('③ 用途が異なるトークン（email_confirmation）: token_not_foundと同じ扱い', async () => {
    verificationTokenRepository.findByTokenHash.mockResolvedValue(buildToken({ purpose: 'email_confirmation' }))

    await expect(resetPassword.execute('raw-token', 'new-password123', ctx)).rejects.toBeInstanceOf(AppError)

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.metadata).toEqual({ reason: 'token_not_found' })
  })

  it('④ 使用済みトークン: AppError(400)、監査ログ(failure, already_consumed)', async () => {
    verificationTokenRepository.findByTokenHash.mockResolvedValue(buildToken({ consumedAt: new Date() }))

    await expect(resetPassword.execute('raw-token', 'new-password123', ctx)).rejects.toBeInstanceOf(AppError)

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.metadata).toEqual({ reason: 'already_consumed' })
    expect(identityRepository.updatePasswordHash).not.toHaveBeenCalled()
  })

  it('⑤ 期限切れトークン: AppError(400)、監査ログ(failure, expired)', async () => {
    verificationTokenRepository.findByTokenHash.mockResolvedValue(
      buildToken({ expiresAt: new Date(Date.now() - 1000) }),
    )

    await expect(resetPassword.execute('raw-token', 'new-password123', ctx)).rejects.toBeInstanceOf(AppError)

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.metadata).toEqual({ reason: 'expired' })
  })

  it('⑥ 新パスワードが短すぎる: AppError(400)、トークンは消費しない', async () => {
    verificationTokenRepository.findByTokenHash.mockResolvedValue(buildToken())
    identityRepository.findByUserIdAndProvider.mockResolvedValue(
      new Identity('identity-1', 'user-1', 'email', 'test@example.com', 'old-hash', new Date()),
    )

    await expect(resetPassword.execute('raw-token', 'short', ctx)).rejects.toBeInstanceOf(AppError)

    expect(identityRepository.updatePasswordHash).not.toHaveBeenCalled()
    expect(verificationTokenRepository.markConsumed).not.toHaveBeenCalled()
  })
})
