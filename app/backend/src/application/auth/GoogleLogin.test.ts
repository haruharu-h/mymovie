import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GoogleLogin } from './GoogleLogin.js'
import { Identity } from '../../domain/auth/Identity.js'
import { User } from '../../domain/user/User.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

describe('GoogleLogin（アカウント統合の3分岐）', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let userRepository: jest.Mocked<IUserRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let googleLogin: GoogleLogin

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' }

  beforeEach(() => {
    identityRepository = {
      save: jest.fn<IIdentityRepository['save']>(),
      findByProviderAndProviderId: jest.fn<IIdentityRepository['findByProviderAndProviderId']>(),
    }
    userRepository = {
      save: jest.fn<IUserRepository['save']>(),
      findById: jest.fn<IUserRepository['findById']>(),
      findByEmail: jest.fn<IUserRepository['findByEmail']>(),
      findByName: jest.fn<IUserRepository['findByName']>(),
      updateProfile: jest.fn<IUserRepository['updateProfile']>(),
    }
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
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')
    jwtService.hashToken.mockReturnValue('hash')
    googleLogin = new GoogleLogin(
      identityRepository, userRepository, sessionRepository, auditLogRepository, jwtService,
    )
  })

  it('① 既存の Google Identity → ログインのみ（User も Identity も作らない）', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(
      new Identity('id-1', 'existing-user', 'google', 'google-sub', null, new Date()),
    )

    const result = await googleLogin.execute('google-sub', 'a@example.com', 'Alice', ctx)

    expect(result.accessToken).toBe('access-token-123')
    expect(userRepository.save).not.toHaveBeenCalled()
    expect(identityRepository.save).not.toHaveBeenCalled()
    expect(sessionRepository.save).toHaveBeenCalledTimes(1)
  })

  it('② 同じメールの既存ユーザーあり → Identity を追加して統合（User は作らない）', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
    userRepository.findByEmail.mockResolvedValue(
      new User('existing-user', 'Alice', 'a@example.com', null, null, new Date()),
    )

    await googleLogin.execute('google-sub', 'a@example.com', 'Alice', ctx)

    expect(userRepository.save).not.toHaveBeenCalled()        // 既存ユーザーに統合
    expect(identityRepository.save).toHaveBeenCalledTimes(1)   // Identity は追加
    const savedIdentity = identityRepository.save.mock.calls[0][0]
    expect(savedIdentity.userId).toBe('existing-user')
    expect(savedIdentity.provider).toBe('google')
  })

  it('③ 完全新規 → User と Identity を両方作る', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
    userRepository.findByEmail.mockResolvedValue(null)

    await googleLogin.execute('google-sub', 'new@example.com', 'Bob', ctx)

    expect(userRepository.save).toHaveBeenCalledTimes(1)
    expect(identityRepository.save).toHaveBeenCalledTimes(1)
    const savedUser = userRepository.save.mock.calls[0][0]
    expect(savedUser.email).toBe('new@example.com')
    expect(savedUser.name).toBe('Bob')
  })
})
