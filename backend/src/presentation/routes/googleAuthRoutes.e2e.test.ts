import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { Google } from 'arctic'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { fakeOAuth2Tokens, fakeIdToken } from '../../../jest/fakeOAuth2Tokens.js'
import { GoogleLogin } from '../../application/auth/GoogleLogin.js'
import { Identity } from '../../domain/auth/Identity.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../../application/shared/JwtService.js'

// E2E: リポジトリ・JwtService・arctic の Google クライアントを偽物にし、
// ルート・ユースケース・エラーハンドラは本物を動かす。
// `decodeIdToken` は本物のarcticを使う（署名検証はしないので、fakeIdToken()でJWTの形だけ整えたペイロードを渡す）。
describe('googleAuthRoutes (E2E)', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let userRepository: jest.Mocked<IUserRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let google: jest.Mocked<Google>
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
    google = {
      createAuthorizationURL: jest.fn<Google['createAuthorizationURL']>(),
      validateAuthorizationCode: jest.fn<Google['validateAuthorizationCode']>(),
    } as unknown as jest.Mocked<Google>

    app = buildApp(
      {
        googleAuth: {
          googleLogin: new GoogleLogin(
            identityRepository, userRepository, sessionRepository, auditLogRepository, jwtService,
          ),
          google,
          frontendUrl: 'http://localhost:5173',
        },
      },
      { logger: false, forceFlushTelemetry: false },
    )
  })

  afterEach(async () => {
    await app.close()
    jest.restoreAllMocks()
  })

  describe('GET /auth/google', () => {
    it('Googleの認可URLへリダイレクトし、state/code_verifierをCookieに保存する', async () => {
      google.createAuthorizationURL.mockReturnValue(new URL('https://accounts.google.com/o/oauth2/v2/auth?state=xxx'))

      const res = await app.inject({ method: 'GET', url: '/auth/google' })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth?state=xxx')
      expect(res.cookies.find(c => c.name === 'google_oauth_state')).toBeDefined()
      expect(res.cookies.find(c => c.name === 'google_code_verifier')).toBeDefined()
    })
  })

  describe('GET /auth/google/callback', () => {
    it('stateが一致しなければ400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=abc&state=wrong-state',
        cookies: { google_oauth_state: 'expected-state', google_code_verifier: 'verifier' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('新規ユーザーの場合: ユーザー作成・refresh_tokenをCookieで返しフロントへリダイレクトする', async () => {
      google.validateAuthorizationCode.mockResolvedValue(fakeOAuth2Tokens({ idToken: fakeIdToken({ sub: 'google-sub-1', email: 'user@example.com', name: 'Taro' }) }))
      identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
      userRepository.findByEmail.mockResolvedValue(null)
      jwtService.generateAccessToken.mockResolvedValue('access-token-123')
      jwtService.hashToken.mockReturnValue('hashed-refresh-token')

      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=valid-code&state=expected-state',
        cookies: { google_oauth_state: 'expected-state', google_code_verifier: 'verifier' },
      })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/auth/callback')
      expect(res.cookies.find(c => c.name === 'refresh_token')?.httpOnly).toBe(true)
      expect(userRepository.save).toHaveBeenCalledTimes(1)
      expect(identityRepository.save).toHaveBeenCalledTimes(1)
    })

    it('同じメールの既存ユーザーがいる場合: 新規作成せずGoogle Identityだけ追加する（アカウント統合）', async () => {
      google.validateAuthorizationCode.mockResolvedValue(fakeOAuth2Tokens({ idToken: fakeIdToken({ sub: 'google-sub-1', email: 'user@example.com', name: 'Taro' }) }))
      identityRepository.findByProviderAndProviderId.mockResolvedValue(null)
      userRepository.findByEmail.mockResolvedValue({ id: 'existing-user-1', name: 'Taro', email: 'user@example.com', birthdate: null, snsUrl: null, createdAt: new Date() })
      jwtService.generateAccessToken.mockResolvedValue('access-token-123')
      jwtService.hashToken.mockReturnValue('hashed-refresh-token')

      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=valid-code&state=expected-state',
        cookies: { google_oauth_state: 'expected-state', google_code_verifier: 'verifier' },
      })

      expect(res.statusCode).toBe(302)
      expect(userRepository.save).not.toHaveBeenCalled()
      expect(identityRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'existing-user-1', provider: 'google' }))
    })

    it('既存のGoogle Identityがある場合: そのままログインする', async () => {
      google.validateAuthorizationCode.mockResolvedValue(fakeOAuth2Tokens({ idToken: fakeIdToken({ sub: 'google-sub-1', email: 'user@example.com', name: 'Taro' }) }))
      identityRepository.findByProviderAndProviderId.mockResolvedValue(
        new Identity('identity-1', 'existing-user-1', 'google', 'google-sub-1', null, new Date()),
      )
      jwtService.generateAccessToken.mockResolvedValue('access-token-123')
      jwtService.hashToken.mockReturnValue('hashed-refresh-token')

      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=valid-code&state=expected-state',
        cookies: { google_oauth_state: 'expected-state', google_code_verifier: 'verifier' },
      })

      expect(res.statusCode).toBe(302)
      expect(userRepository.save).not.toHaveBeenCalled()
      expect(identityRepository.save).not.toHaveBeenCalled()
      expect(sessionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'existing-user-1' }))
    })
  })
})
