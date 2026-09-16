import { randomUUID } from 'crypto'
import { AppError } from '../../domain/shared/AppError.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import { Email } from '../../domain/auth/Email.js'
import { Password } from '../../domain/auth/Password.js'

import { Session } from '../../domain/auth/Session.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type LoginResult = {
  accessToken: string
  refreshToken: string
}

type LoginContext = {
  ipAddress: string
  userAgent: string
}

export class LoginUser {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(rawEmail: string, rawPassword: string, ctx: LoginContext): Promise<LoginResult> {
    try {
      // 1. バリデーション
      const email = Email.create(rawEmail)

      // 2. Identity を検索する
      const identity = await this.identityRepository.findByProviderAndProviderId('email', email.value)

      // 3. 存在しない場合はエラー（列挙攻撃対策でパスワード間違いと同じメッセージ）
      if (!identity || !identity.passwordHash) {
        await this.auditLogRepository.save(new AuditLog(
          randomUUID(), null, 'auth.login', 'failure',
          ctx.ipAddress, ctx.userAgent,
          { reason: 'identity_not_found' },
          new Date(),
        ))
        throw new AppError('メールアドレスまたはパスワードが正しくありません', 401)
      }

      // 4. パスワードを照合する
      const password = Password.reconstruct(identity.passwordHash)
      const isValid = await password.verify(rawPassword)

      // 5. 照合失敗の場合はエラー
      if (!isValid) {
        await this.auditLogRepository.save(new AuditLog(
          randomUUID(), identity.userId, 'auth.login', 'failure',
          ctx.ipAddress, ctx.userAgent,
          { reason: 'invalid_password' },
          new Date(),
        ))
        throw new AppError('メールアドレスまたはパスワードが正しくありません', 401)
      }

      // 6. アクセストークンを発行する
      const accessToken = await this.jwtService.generateAccessToken(identity.userId)

      // 7. Session を作ってリフレッシュトークンを発行・保存する
      const refreshToken = randomUUID()
      const refreshTokenHash = this.jwtService.hashToken(refreshToken)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const session = new Session(randomUUID(), identity.userId, refreshTokenHash, expiresAt, new Date())
      await this.sessionRepository.save(session)

      // 8. 監査ログ（成功）
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), identity.userId, 'auth.login', 'success',
        ctx.ipAddress, ctx.userAgent, null, new Date(),
      ))

      return { accessToken, refreshToken }

    } catch (error) {
      if (error instanceof AppError) throw error
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), null, 'auth.login', 'failure',
        ctx.ipAddress, ctx.userAgent,
        { reason: error instanceof Error ? error.message : 'unknown' },
        new Date(),
      ))
      throw error
    }
  }
}
