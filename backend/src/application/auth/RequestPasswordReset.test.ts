import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { RequestPasswordReset } from './RequestPasswordReset.js'
import { AppError } from '../../domain/shared/AppError.js'
import { Identity } from '../../domain/auth/Identity.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IVerificationTokenRepository } from '../../domain/auth/IVerificationTokenRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { IMailSender } from '../../domain/shared/IMailSender.js'
import type { JwtService } from '../shared/JwtService.js'

const buildIdentity = (passwordHash: string | null): Identity =>
  new Identity('identity-1', 'user-1', 'email', 'test@example.com', passwordHash, new Date())

describe('RequestPasswordReset', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let verificationTokenRepository: jest.Mocked<IVerificationTokenRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let mailSender: jest.Mocked<IMailSender>
  let jwtService: jest.Mocked<JwtService>
  let requestPasswordReset: RequestPasswordReset

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' }

  beforeEach(() => {
    identityRepository = {
      save: jest.fn<IIdentityRepository['save']>(),
      findByProviderAndProviderId: jest.fn<IIdentityRepository['findByProviderAndProviderId']>(),
      findByUserIdAndProvider: jest.fn<IIdentityRepository['findByUserIdAndProvider']>(),
      updatePasswordHash: jest.fn<IIdentityRepository['updatePasswordHash']>(),
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
    mailSender = {
      sendPasswordResetEmail: jest.fn<IMailSender['sendPasswordResetEmail']>(),
      sendEmailConfirmation: jest.fn<IMailSender['sendEmailConfirmation']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>

    requestPasswordReset = new RequestPasswordReset(
      identityRepository,
      verificationTokenRepository,
      auditLogRepository,
      mailSender,
      jwtService,
    )
  })

  it('① 成功: 既存の未使用トークンを消し、新しいトークンを保存してメールを送る', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(buildIdentity('hashed-password'))
    jwtService.hashToken.mockReturnValue('hashed-token')

    await requestPasswordReset.execute('test@example.com', ctx)

    expect(verificationTokenRepository.deleteActiveByUserIdAndPurpose).toHaveBeenCalledWith('user-1', 'password_reset')

    expect(verificationTokenRepository.save).toHaveBeenCalledTimes(1)
    const savedToken = verificationTokenRepository.save.mock.calls[0][0]
    expect(savedToken.userId).toBe('user-1')
    expect(savedToken.purpose).toBe('password_reset')
    expect(savedToken.tokenHash).toBe('hashed-token')

    expect(mailSender.sendPasswordResetEmail).toHaveBeenCalledTimes(1)
    const [to, rawToken] = mailSender.sendPasswordResetEmail.mock.calls[0]
    expect(to).toBe('test@example.com')
    expect(typeof rawToken).toBe('string')

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.action).toBe('auth.password_reset.request')
    expect(savedLog.result).toBe('success')
  })

  it('② Identityが存在しない: 例外を投げず、監査ログ(failure, identity_not_found)のみ記録する', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)

    await expect(requestPasswordReset.execute('test@example.com', ctx)).resolves.toBeUndefined()

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.result).toBe('failure')
    expect(savedLog.metadata).toEqual({ reason: 'identity_not_found' })
    expect(verificationTokenRepository.save).not.toHaveBeenCalled()
    expect(mailSender.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('③ OAuthのみのIdentity（passwordHashなし）: ②と同じ扱いにする', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(buildIdentity(null))

    await requestPasswordReset.execute('test@example.com', ctx)

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.metadata).toEqual({ reason: 'identity_not_found' })
    expect(mailSender.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('④ メール形式が不正: AppError(400)を投げ、監査ログ(failure)を記録する', async () => {
    expect.assertions(3)
    try {
      await requestPasswordReset.execute('not-an-email', ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.result).toBe('failure')
  })
})
