import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GitHubLogin } from './GitHubLogin.js'
import { Identity } from '../../domain/auth/Identity.js'
import { User } from '../../domain/user/User.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

describe('GitHubLogin（アカウント統合 + メールnullの分岐）', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let userRepository: jest.Mocked<IUserRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let githubLogin: GitHubLogin

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' }

  beforeEach(() => {
    identityRepository = {
      save: jest.fn<IIdentityRepository['save']>(),
      findByProviderAndProviderId: jest.fn<IIdentityRepository['findByProviderAndProviderId']>(),
      findByUserIdAndProvider: jest.fn<IIdentityRepository['findByUserIdAndProvider']>(),
      updatePasswordHash: jest.fn<IIdentityRepository['updatePasswordHash']>(),
    }
    userRepository = {
      save: jest.fn<IUserRepository['save']>(),
      findById: jest.fn<IUserRepository['findById']>(),
      findByEmail: jest.fn<IUserRepository['findByEmail']>(),
      findByName: jest.fn<IUserRepository['findByName']>(),
      updateProfile: jest.fn<IUserRepository['updateProfile']>(),
      updateAvatarUrl: jest.fn<IUserRepository['updateAvatarUrl']>(),
    }
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
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')
    jwtService.hashToken.mockReturnValue('hash')
    githubLogin = new GitHubLogin(
      identityRepository, userRepository, sessionRepository, auditLogRepository, jwtService,
    )
  })

  it('① 既存の GitHub Identity → ログインのみ', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(
      new Identity('id-1', 'existing-user', 'github', 'gh-1', null, new Date()),
    )

    const result = await githubLogin.execute('gh-1', 'Alice', 'a@example.com', ctx)

    expect(result.accessToken).toBe('access-token-123')
    expect(userRepository.save).not.toHaveBeenCalled()
    expect(identityRepository.save).not.toHaveBeenCalled()
  })

  it('② 同じメールの既存ユーザーあり → 統合（User は作らない）', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
    userRepository.findByEmail.mockResolvedValue(
      new User('existing-user', 'Alice', 'a@example.com', null, null, null, new Date()),
    )

    await githubLogin.execute('gh-1', 'Alice', 'a@example.com', ctx)

    expect(userRepository.save).not.toHaveBeenCalled()
    expect(identityRepository.save).toHaveBeenCalledTimes(1)
  })

  it('③ email が null なら findByEmail せず、新規 User を作る', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)

    await githubLogin.execute('gh-1', 'Bob', null, ctx)

    // email が null なので既存ユーザー検索はスキップされる
    expect(userRepository.findByEmail).not.toHaveBeenCalled()
    expect(userRepository.save).toHaveBeenCalledTimes(1)
    expect(identityRepository.save).toHaveBeenCalledTimes(1)
  })
})
