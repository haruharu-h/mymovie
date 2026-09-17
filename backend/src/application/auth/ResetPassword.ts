import { randomUUID } from 'crypto'
import { AppError } from '../../domain/shared/AppError.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import { Password } from '../../domain/auth/Password.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IVerificationTokenRepository } from '../../domain/auth/IVerificationTokenRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type ResetPasswordContext = {
  ipAddress: string
  userAgent: string
}

export class ResetPassword {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(rawToken: string, newRawPassword: string, ctx: ResetPasswordContext): Promise<void> {
    try {
      const tokenHash = this.jwtService.hashToken(rawToken)
      const token = await this.verificationTokenRepository.findByTokenHash(tokenHash)

      if (!token || token.purpose !== 'password_reset') {
        await this.auditLogRepository.save(new AuditLog(
          randomUUID(), null, 'auth.password_reset.confirm', 'failure',
          ctx.ipAddress, ctx.userAgent, { reason: 'token_not_found' }, new Date(),
        ))
        throw new AppError('無効なトークンです', 400)
      }

      // 使用済みトークンの再利用は、ガラクタな文字列を投げてくる攻撃とは別の
      // 具体的な兆候（盗み見られたリンクの使い回し等）として区別して記録する
      if (token.isConsumed()) {
        await this.auditLogRepository.save(new AuditLog(
          randomUUID(), token.userId, 'auth.password_reset.confirm', 'failure',
          ctx.ipAddress, ctx.userAgent, { reason: 'already_consumed' }, new Date(),
        ))
        throw new AppError('このリンクは既に使用されています', 400)
      }

      if (token.isExpired()) {
        await this.auditLogRepository.save(new AuditLog(
          randomUUID(), token.userId, 'auth.password_reset.confirm', 'failure',
          ctx.ipAddress, ctx.userAgent, { reason: 'expired' }, new Date(),
        ))
        throw new AppError('有効期限が切れています。もう一度リセットをリクエストしてください', 400)
      }

      const identity = await this.identityRepository.findByUserIdAndProvider(token.userId, 'email')
      if (!identity) {
        throw new Error(`email identity not found for user ${token.userId}`)
      }

      const password = await Password.create(newRawPassword)
      await this.identityRepository.updatePasswordHash(identity.id, password.value)
      await this.verificationTokenRepository.markConsumed(token.id, new Date())

      // パスワードリセットは「乗っ取られていたかもしれないセッション」を想定した操作のため、
      // 既存のログインセッションを全て強制的に無効化する（OWASPのベストプラクティス）
      await this.sessionRepository.deleteAllByUserId(token.userId)

      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), token.userId, 'auth.password_reset.confirm', 'success',
        ctx.ipAddress, ctx.userAgent, null, new Date(),
      ))
    } catch (error) {
      if (error instanceof AppError) throw error
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), null, 'auth.password_reset.confirm', 'failure',
        ctx.ipAddress, ctx.userAgent,
        { reason: error instanceof Error ? error.message : 'unknown' },
        new Date(),
      ))
      throw error
    }
  }
}
