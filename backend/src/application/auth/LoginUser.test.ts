import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { LoginUser } from './LoginUser.js'
import { AppError } from '../../domain/shared/AppError.js'
import { Identity } from '../../domain/auth/Identity.js'
import { Password } from '../../domain/auth/Password.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

// email プロバイダーの Identity を組み立てるヘルパー。passwordHash を差し替えて一致/不一致を作り分ける
const buildIdentity = (passwordHash: string | null): Identity =>
  new Identity('id-1', 'user-1', 'email', 'test@example.com', passwordHash, new Date())

describe('LoginUser', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let loginUser: LoginUser

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
    auditLogRepository = {
      save: jest.fn<IAuditLogRepository['save']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>

    loginUser = new LoginUser(
      identityRepository,
      sessionRepository,
      auditLogRepository,
      jwtService,
    )
  })

  it('① 成功: トークンを返し、Session・監査ログ(success) を保存する', async () => {
    // Arrange: 保存済みハッシュは execute に渡すパスワードと同じものにする（argon2 は本物が動く）
    const passwordHash = (await Password.create('password123')).value
    identityRepository.findByProviderAndProviderId.mockResolvedValue(buildIdentity(passwordHash))
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')
    jwtService.hashToken.mockReturnValue('hashed-refresh-token')

    // Act
    const result = await loginUser.execute('test@example.com', 'password123', ctx)

    // Assert: 返り値
    expect(result.accessToken).toBe('access-token-123')
    expect(typeof result.refreshToken).toBe('string')

    // Assert: 副作用
    expect(sessionRepository.save).toHaveBeenCalledTimes(1)
    expect(auditLogRepository.save).toHaveBeenCalledTimes(1)
    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.action).toBe('auth.login')
    expect(savedLog.result).toBe('success')
  })

  it('② Identity が存在しない: AppError(401)、監査ログ(failure, identity_not_found)、Session は保存しない', async () => {
    // Arrange: そのメールは未登録
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)

    expect.assertions(5)
    try {
      await loginUser.execute('test@example.com', 'password123', ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(401)
    }

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.result).toBe('failure')
    expect(savedLog.metadata).toEqual({ reason: 'identity_not_found' })
    expect(sessionRepository.save).not.toHaveBeenCalled()
  })

  it('③ パスワード不一致: AppError(401)、監査ログ(failure, invalid_password)、Session は保存しない', async () => {
    // Arrange: 保存済みハッシュは別パスワードのもの → verify が false になる
    const passwordHash = (await Password.create('correct-password')).value
    identityRepository.findByProviderAndProviderId.mockResolvedValue(buildIdentity(passwordHash))

    expect.assertions(5)
    try {
      await loginUser.execute('test@example.com', 'wrong-password', ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(401)
    }

    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.result).toBe('failure')
    expect(savedLog.metadata).toEqual({ reason: 'invalid_password' })
    expect(sessionRepository.save).not.toHaveBeenCalled()
  })
})
