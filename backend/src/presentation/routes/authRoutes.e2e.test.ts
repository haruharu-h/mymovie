import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { RegisterUser } from '../../application/auth/RegisterUser.js'
import { LoginUser } from '../../application/auth/LoginUser.js'
import { RefreshToken } from '../../application/auth/RefreshToken.js'
import { LogoutUser } from '../../application/auth/LogoutUser.js'
import { RequestPasswordReset } from '../../application/auth/RequestPasswordReset.js'
import { ResetPassword } from '../../application/auth/ResetPassword.js'
import { Identity } from '../../domain/auth/Identity.js'
import { Password } from '../../domain/auth/Password.js'
import { VerificationToken } from '../../domain/auth/VerificationToken.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IVerificationTokenRepository } from '../../domain/auth/IVerificationTokenRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { IMailSender } from '../../domain/shared/IMailSender.js'
import type { JwtService } from '../../application/shared/JwtService.js'

// E2E（HTTPレベル）: リポジトリと JwtService だけ偽物にし、
// ルート・ユースケース・エラーハンドラ・Fastify は本物を動かして app.inject() で叩く。
describe('auth routes (E2E)', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let userRepository: jest.Mocked<IUserRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let verificationTokenRepository: jest.Mocked<IVerificationTokenRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let mailSender: jest.Mocked<IMailSender>
  let jwtService: jest.Mocked<JwtService>
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

    // 本物のユースケースを偽物のインフラで組み立て、auth ルートだけのアプリを作る
    app = buildApp(
      {
        auth: {
          registerUser: new RegisterUser(
            identityRepository, userRepository, sessionRepository, auditLogRepository, jwtService,
          ),
          loginUser: new LoginUser(identityRepository, sessionRepository, auditLogRepository, jwtService),
          refreshToken: new RefreshToken(sessionRepository, auditLogRepository, jwtService),
          logoutUser: new LogoutUser(sessionRepository, auditLogRepository, jwtService),
          requestPasswordReset: new RequestPasswordReset(
            identityRepository, verificationTokenRepository, auditLogRepository, mailSender, jwtService,
          ),
          resetPassword: new ResetPassword(
            identityRepository, sessionRepository, verificationTokenRepository, auditLogRepository, jwtService,
          ),
        },
      },
      { logger: false, forceFlushTelemetry: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('POST /auth/register 成功: 200・body は accessToken のみ・refresh_token を httpOnly Cookie で返す', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null) // メール未登録
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')
    jwtService.hashToken.mockReturnValue('hashed-refresh-token')

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    })

    // ① ステータスコード
    expect(res.statusCode).toBe(200)

    // ② body の形: accessToken のみ（refreshToken は body に載らない）
    const body = res.json()
    expect(body).toEqual({ accessToken: 'access-token-123' })
    expect(body.refreshToken).toBeUndefined()

    // ③ Cookie: refresh_token が httpOnly で返る
    const cookie = res.cookies.find(c => c.name === 'refresh_token')
    expect(cookie).toBeDefined()
    expect(cookie?.httpOnly).toBe(true)
  })

  it('POST /auth/register バリデーション失敗: 400・body は { message }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'abc' }, // 8文字未満
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('message')
    expect(res.cookies.find(c => c.name === 'refresh_token')).toBeUndefined() // Cookieは付かない
  })

  it('POST /auth/register passwordが無ければ 400（Zodスキーマによるバリデーション）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
    expect(identityRepository.findByProviderAndProviderId).not.toHaveBeenCalled()
  })

  it('POST /auth/register 重複: 409・body は { message }', async () => {
    const existing = new Identity('id-1', 'user-1', 'email', 'test@example.com', 'hash', new Date())
    identityRepository.findByProviderAndProviderId.mockResolvedValue(existing)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toHaveProperty('message')
  })

  it('POST /auth/login 成功: 200・accessToken・refresh_token Cookie', async () => {
    const passwordHash = (await Password.create('password123')).value
    identityRepository.findByProviderAndProviderId.mockResolvedValue(
      new Identity('id-1', 'user-1', 'email', 'test@example.com', passwordHash, new Date()),
    )
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')
    jwtService.hashToken.mockReturnValue('hashed-refresh-token')

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ accessToken: 'access-token-123' })
    expect(res.cookies.find(c => c.name === 'refresh_token')?.httpOnly).toBe(true)
  })

  it('POST /auth/login emailが無ければ 400（Zodスキーマによるバリデーション）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { password: 'password123' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
    expect(identityRepository.findByProviderAndProviderId).not.toHaveBeenCalled()
  })

  it('POST /auth/login パスワード不一致: 401・Cookie は付かない', async () => {
    const passwordHash = (await Password.create('correct-password')).value
    identityRepository.findByProviderAndProviderId.mockResolvedValue(
      new Identity('id-1', 'user-1', 'email', 'test@example.com', passwordHash, new Date()),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'wrong-password' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.cookies.find(c => c.name === 'refresh_token')).toBeUndefined()
  })

  it('POST /auth/password-reset/request 成功: 204、メールアドレス未登録でも同じ204', async () => {
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/password-reset/request',
      payload: { email: 'not-registered@example.com' },
    })

    expect(res.statusCode).toBe(204)
    expect(mailSender.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('POST /auth/password-reset/request emailが無ければ 400（Zodスキーマによるバリデーション）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/password-reset/request',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    expect(identityRepository.findByProviderAndProviderId).not.toHaveBeenCalled()
  })

  it('POST /auth/password-reset/confirm 無効なトークン: 400・body は { message }', async () => {
    verificationTokenRepository.findByTokenHash.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/password-reset/confirm',
      payload: { token: 'invalid-token', newPassword: 'new-password123' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('message')
  })

  it('POST /auth/password-reset/confirm 成功: 204、パスワード更新・全セッション削除', async () => {
    const token = new VerificationToken(
      'token-1', 'user-1', 'password_reset', 'hashed-token',
      new Date(Date.now() + 60 * 60 * 1000), null, new Date(),
    )
    verificationTokenRepository.findByTokenHash.mockResolvedValue(token)
    identityRepository.findByUserIdAndProvider.mockResolvedValue(
      new Identity('identity-1', 'user-1', 'email', 'test@example.com', 'old-hash', new Date()),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/auth/password-reset/confirm',
      payload: { token: 'raw-token', newPassword: 'new-password123' },
    })

    expect(res.statusCode).toBe(204)
    expect(identityRepository.updatePasswordHash).toHaveBeenCalledWith('identity-1', expect.any(String))
    expect(sessionRepository.deleteAllByUserId).toHaveBeenCalledWith('user-1')
  })
})
