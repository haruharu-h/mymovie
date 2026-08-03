import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { LogoutUser } from './LogoutUser.js'
import { Session } from '../../domain/auth/Session.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

describe('LogoutUser', () => {
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let logoutUser: LogoutUser

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' }

  beforeEach(() => {
    sessionRepository = {
      save: jest.fn<ISessionRepository['save']>(),
      findByRefreshTokenHash: jest.fn<ISessionRepository['findByRefreshTokenHash']>(),
      updateRefreshTokenHash: jest.fn<ISessionRepository['updateRefreshTokenHash']>(),
      delete: jest.fn<ISessionRepository['delete']>(),
    }
    auditLogRepository = { save: jest.fn<IAuditLogRepository['save']>() }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    logoutUser = new LogoutUser(sessionRepository, auditLogRepository, jwtService)
  })

  it('Session が無ければ静かに終わる（削除もログもしない）', async () => {
    jwtService.hashToken.mockReturnValue('hash')
    sessionRepository.findByRefreshTokenHash.mockResolvedValue(null)

    await logoutUser.execute('raw-token', ctx)

    expect(sessionRepository.delete).not.toHaveBeenCalled()
    expect(auditLogRepository.save).not.toHaveBeenCalled()
  })

  it('Session があれば削除して監査ログ(success)', async () => {
    jwtService.hashToken.mockReturnValue('hash')
    sessionRepository.findByRefreshTokenHash.mockResolvedValue(
      new Session('session-1', 'user-1', 'hash', new Date(), new Date()),
    )

    await logoutUser.execute('raw-token', ctx)

    expect(sessionRepository.delete).toHaveBeenCalledWith('session-1')
    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.action).toBe('auth.logout')
    expect(savedLog.result).toBe('success')
  })
})
