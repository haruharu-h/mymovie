import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { RefreshToken } from './RefreshToken.js'
import { Session } from '../../domain/auth/Session.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

const buildSession = (expiresAt: Date): Session =>
  new Session('session-1', 'user-1', 'stored-hash', expiresAt, new Date())

describe('RefreshToken', () => {
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let refreshToken: RefreshToken

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' }

  beforeEach(() => {
    sessionRepository = {
      save: jest.fn<ISessionRepository['save']>(),
      findByRefreshTokenHash: jest.fn<ISessionRepository['findByRefreshTokenHash']>(),
      updateRefreshTokenHash: jest.fn<ISessionRepository['updateRefreshTokenHash']>(),
      delete: jest.fn<ISessionRepository['delete']>(),
      deleteAllByUserId: jest.fn<ISessionRepository['deleteAllByUserId']>(),
    }
    auditLogRepository = { save: jest.fn<IAuditLogRepository['save']>() }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    refreshToken = new RefreshToken(sessionRepository, auditLogRepository, jwtService)
  })

  it('Session が見つからなければ AppError(401)、ローテーションしない', async () => {
    jwtService.hashToken.mockReturnValue('hash')
    sessionRepository.findByRefreshTokenHash.mockResolvedValue(null)

    expect.assertions(3)
    try {
      await refreshToken.execute('raw-token', ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(401)
    }
    expect(sessionRepository.updateRefreshTokenHash).not.toHaveBeenCalled()
  })

  it('有効期限切れなら Session を削除して AppError(401)', async () => {
    jwtService.hashToken.mockReturnValue('hash')
    sessionRepository.findByRefreshTokenHash.mockResolvedValue(buildSession(new Date(Date.now() - 1000)))

    expect.assertions(3)
    try {
      await refreshToken.execute('raw-token', ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(401)
    }
    expect(sessionRepository.delete).toHaveBeenCalledWith('session-1')
  })

  it('有効なら新トークンを発行し、ローテーションして監査ログ(success)', async () => {
    jwtService.hashToken.mockReturnValue('new-hash')
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')
    sessionRepository.findByRefreshTokenHash.mockResolvedValue(buildSession(new Date(Date.now() + 60_000)))

    const result = await refreshToken.execute('raw-token', ctx)

    expect(result.accessToken).toBe('access-token-123')
    expect(typeof result.refreshToken).toBe('string')
    expect(sessionRepository.updateRefreshTokenHash).toHaveBeenCalledTimes(1)
    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.action).toBe('auth.token.refresh')
    expect(savedLog.result).toBe('success')
  })
})
