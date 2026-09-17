import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { GitHub } from 'arctic'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { fakeOAuth2Tokens } from '../../../jest/fakeOAuth2Tokens.js'
import { GitHubLogin } from '../../application/auth/GitHubLogin.js'
import { Identity } from '../../domain/auth/Identity.js'
import type { GitHubApiClient, GitHubEmail, GitHubUser } from '../../infrastructure/external/GitHubApiClient.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../../application/shared/JwtService.js'

// E2E: リポジトリ・JwtService・arctic の GitHub クライアント・GitHubApiClient を偽物にし、
// ルート・ユースケース・エラーハンドラは本物を動かす。
describe('githubAuthRoutes (E2E)', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let userRepository: jest.Mocked<IUserRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let github: jest.Mocked<GitHub>
  let gitHubApiClient: jest.Mocked<GitHubApiClient>
  let app: FastifyInstance

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
    auditLogRepository = {
      save: jest.fn<IAuditLogRepository['save']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    github = {
      createAuthorizationURL: jest.fn<GitHub['createAuthorizationURL']>(),
      validateAuthorizationCode: jest.fn<GitHub['validateAuthorizationCode']>(),
    } as unknown as jest.Mocked<GitHub>
    gitHubApiClient = {
      getUser: jest.fn<GitHubApiClient['getUser']>(),
      getUserEmails: jest.fn<GitHubApiClient['getUserEmails']>(),
    } as unknown as jest.Mocked<GitHubApiClient>

    app = buildApp(
      {
        githubAuth: {
          githubLogin: new GitHubLogin(
            identityRepository, userRepository, sessionRepository, auditLogRepository, jwtService,
          ),
          github,
          gitHubApiClient,
          frontendUrl: 'http://localhost:5173',
        },
      },
      { logger: false, forceFlushTelemetry: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  const githubUser: GitHubUser = { id: 12345, name: 'Taro Yamada', login: 'taro-yamada' }
  const primaryEmail: GitHubEmail[] = [{ email: 'taro@example.com', primary: true, verified: true }]

  describe('GET /auth/github', () => {
    it('GitHubの認可URLへリダイレクトし、stateをCookieに保存する', async () => {
      github.createAuthorizationURL.mockReturnValue(new URL('https://github.com/login/oauth/authorize?state=xxx'))

      const res = await app.inject({ method: 'GET', url: '/auth/github' })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('https://github.com/login/oauth/authorize?state=xxx')
      expect(res.cookies.find(c => c.name === 'github_oauth_state')).toBeDefined()
    })
  })

  describe('GET /auth/github/callback', () => {
    it('stateが一致しなければ400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/github/callback?code=abc&state=wrong-state',
        cookies: { github_oauth_state: 'expected-state' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('新規ユーザーの場合: ユーザー作成・refresh_tokenをCookieで返しフロントへリダイレクトする', async () => {
      github.validateAuthorizationCode.mockResolvedValue(fakeOAuth2Tokens())
      gitHubApiClient.getUser.mockResolvedValue(githubUser)
      gitHubApiClient.getUserEmails.mockResolvedValue(primaryEmail)
      identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
      userRepository.findByEmail.mockResolvedValue(null)
      jwtService.generateAccessToken.mockResolvedValue('access-token-123')
      jwtService.hashToken.mockReturnValue('hashed-refresh-token')

      const res = await app.inject({
        method: 'GET',
        url: '/auth/github/callback?code=valid-code&state=expected-state',
        cookies: { github_oauth_state: 'expected-state' },
      })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/auth/callback')
      expect(res.cookies.find(c => c.name === 'refresh_token')?.httpOnly).toBe(true)
      expect(userRepository.save).toHaveBeenCalledTimes(1)
      expect(identityRepository.save).toHaveBeenCalledWith(expect.objectContaining({ providerId: '12345' }))
    })

    it('primaryかつverifiedなメールが無い場合: メールnullでユーザーを作成する', async () => {
      github.validateAuthorizationCode.mockResolvedValue(fakeOAuth2Tokens())
      gitHubApiClient.getUser.mockResolvedValue(githubUser)
      gitHubApiClient.getUserEmails.mockResolvedValue([{ email: 'unverified@example.com', primary: true, verified: false }])
      identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
      jwtService.generateAccessToken.mockResolvedValue('access-token-123')
      jwtService.hashToken.mockReturnValue('hashed-refresh-token')

      const res = await app.inject({
        method: 'GET',
        url: '/auth/github/callback?code=valid-code&state=expected-state',
        cookies: { github_oauth_state: 'expected-state' },
      })

      expect(res.statusCode).toBe(302)
      expect(userRepository.findByEmail).not.toHaveBeenCalled()
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ email: null }))
    })

    it('既存のGitHub Identityがある場合: そのままログインする', async () => {
      github.validateAuthorizationCode.mockResolvedValue(fakeOAuth2Tokens())
      gitHubApiClient.getUser.mockResolvedValue(githubUser)
      gitHubApiClient.getUserEmails.mockResolvedValue(primaryEmail)
      identityRepository.findByProviderAndProviderId.mockResolvedValue(
        new Identity('identity-1', 'existing-user-1', 'github', '12345', null, new Date()),
      )
      jwtService.generateAccessToken.mockResolvedValue('access-token-123')
      jwtService.hashToken.mockReturnValue('hashed-refresh-token')

      const res = await app.inject({
        method: 'GET',
        url: '/auth/github/callback?code=valid-code&state=expected-state',
        cookies: { github_oauth_state: 'expected-state' },
      })

      expect(res.statusCode).toBe(302)
      expect(userRepository.save).not.toHaveBeenCalled()
      expect(identityRepository.save).not.toHaveBeenCalled()
      expect(sessionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'existing-user-1' }))
    })
  })
})
