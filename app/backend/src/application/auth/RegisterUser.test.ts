import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { RegisterUser } from './RegisterUser.js'
import { AppError } from '../../domain/shared/AppError.js'
import { Identity } from '../../domain/auth/Identity.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

describe('RegisterUser', () => {
  let identityRepository: jest.Mocked<IIdentityRepository>
  let userRepository: jest.Mocked<IUserRepository>
  let sessionRepository: jest.Mocked<ISessionRepository>
  let auditLogRepository: jest.Mocked<IAuditLogRepository>
  let jwtService: jest.Mocked<JwtService>
  let registerUser: RegisterUser

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
    auditLogRepository = {
      save: jest.fn<IAuditLogRepository['save']>(),
    }
    // JwtService はクラス（private secret を持つ）なので、メソッドだけの偽物は型が合わない。
    // as unknown as で jest.Mocked<JwtService> に橋渡しする。
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>

    registerUser = new RegisterUser(
      identityRepository,
      userRepository,
      sessionRepository,
      auditLogRepository,
      jwtService,
    )
  })

  it('① 成功: トークンを返し、User・Session・監査ログ(success) を保存する', async () => {
    // Arrange: 成功パスを通すための仕込み
    identityRepository.findByProviderAndProviderId.mockResolvedValue(null) // メール未登録
    jwtService.generateAccessToken.mockResolvedValue('access-token-123')   // アクセストークン
    jwtService.hashToken.mockReturnValue('hashed-refresh-token')           // リフレッシュのハッシュ

    // Act
    const result = await registerUser.execute('test@example.com', 'password123', ctx)

    // Assert: 返り値
    expect(result.accessToken).toBe('access-token-123') // 仕込んだ値がそのまま返る
    expect(typeof result.refreshToken).toBe('string')   // randomUUID 由来なので存在だけ確認

    // Assert: 起きてほしい副作用（保存が呼ばれたか）
    expect(userRepository.save).toHaveBeenCalledTimes(1)
    expect(identityRepository.save).toHaveBeenCalledTimes(1)
    expect(sessionRepository.save).toHaveBeenCalledTimes(1)

    // Assert: 監査ログが success で記録されたか
    expect(auditLogRepository.save).toHaveBeenCalledTimes(1)
    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.action).toBe('auth.register')
    expect(savedLog.result).toBe('success')
  })

  it('② バリデーション失敗: AppError(400) を投げ、監査ログ(failure) を残し、User は保存しない', async () => {
    // Arrange: 成功パスの仕込みは不要。パスワードが8文字未満で Password.create が弾く

    // Act + Assert: 例外の種類とステータスコード
    expect.assertions(5)
    try {
      await registerUser.execute('test@example.com', 'abc', ctx) // 'abc' は8文字未満
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }

    // Assert: 失敗しても監査ログは failure で残る（このユースケースの肝）
    expect(auditLogRepository.save).toHaveBeenCalledTimes(1)
    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.result).toBe('failure')

    // Assert: バリデーションで止まったので User は作られていない
    expect(userRepository.save).not.toHaveBeenCalled()
  })

  it('③ 重複: メールが既存なら AppError(409) を投げ、監査ログ(failure) を残し、User は保存しない', async () => {
    // Arrange: 既存の Identity を返させて重複を再現。中身は使われないのでダミーで十分
    const existingIdentity = new Identity('id-1', 'user-1', 'email', 'test@example.com', 'hash', new Date())
    identityRepository.findByProviderAndProviderId.mockResolvedValue(existingIdentity)

    // Act + Assert: 例外の種類とステータスコード
    expect.assertions(5)
    try {
      await registerUser.execute('test@example.com', 'password123', ctx) // 入力自体は正しい
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(409)
    }

    // Assert: 重複でも監査ログは failure で残る
    expect(auditLogRepository.save).toHaveBeenCalledTimes(1)
    const savedLog = auditLogRepository.save.mock.calls[0][0]
    expect(savedLog.result).toBe('failure')

    // Assert: 重複チェックで止まったので User は作られていない
    expect(userRepository.save).not.toHaveBeenCalled()
  })
})
