import { randomUUID } from 'crypto'
import { AppError } from '../../domain/shared/AppError.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type RefreshResult = {
  accessToken: string
  refreshToken: string
}

type RefreshContext = {
  ipAddress: string
  userAgent: string
}

export class RefreshToken {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(rawRefreshToken: string, ctx: RefreshContext): Promise<RefreshResult> {
    try {
      // 1. ハッシュ化して Session を検索する
      const hash = this.jwtService.hashToken(rawRefreshToken)
      const session = await this.sessionRepository.findByRefreshTokenHash(hash)

      // 2. 見つからなければエラー
      if (!session) {
        throw new AppError('無効なリフレッシュトークンです', 401)
      }

      // 3. 有効期限をチェックする
      if (session.isExpired()) {
        await this.sessionRepository.delete(session.id)
        throw new AppError('セッションの有効期限が切れています', 401)
      }

      // 4. アクセストークンを発行する
      const accessToken = await this.jwtService.generateAccessToken(session.userId)

      // 5. リフレッシュトークンをローテーションする
      const newRefreshToken = randomUUID()
      const newRefreshTokenHash = this.jwtService.hashToken(newRefreshToken)
      await this.sessionRepository.updateRefreshTokenHash(session.id, newRefreshTokenHash)

      // 6. 監査ログ（成功）
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), session.userId, 'auth.token.refresh', 'success',
        ctx.ipAddress, ctx.userAgent, null, new Date(),
      ))

      return { accessToken, refreshToken: newRefreshToken }

    } catch (error) {
      if (error instanceof AppError) throw error
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), null, 'auth.token.refresh', 'failure',
        ctx.ipAddress, ctx.userAgent,
        { reason: error instanceof Error ? error.message : 'unknown' },
        new Date(),
      ))
      throw error
    }
  }
}
