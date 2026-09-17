import { randomUUID } from 'crypto'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import { Email } from '../../domain/auth/Email.js'
import { VerificationToken } from '../../domain/auth/VerificationToken.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { IVerificationTokenRepository } from '../../domain/auth/IVerificationTokenRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { IMailSender } from '../../domain/shared/IMailSender.js'
import type { JwtService } from '../shared/JwtService.js'

type RequestPasswordResetContext = {
  ipAddress: string
  userAgent: string
}

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1時間

export class RequestPasswordReset {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly mailSender: IMailSender,
    private readonly jwtService: JwtService,
  ) {}

  async execute(rawEmail: string, ctx: RequestPasswordResetContext): Promise<void> {
    try {
      const email = Email.create(rawEmail)

      // 列挙攻撃対策（LoginUserと同じ方針）: メールアドレスが未登録でもクライアントには
      // 例外を投げない。内部的にはAuditLogへ失敗として記録する
      const identity = await this.identityRepository.findByProviderAndProviderId('email', email.value)
      if (!identity || !identity.passwordHash) {
        await this.auditLogRepository.save(new AuditLog(
          randomUUID(), null, 'auth.password_reset.request', 'failure',
          ctx.ipAddress, ctx.userAgent,
          { reason: 'identity_not_found' },
          new Date(),
        ))
        return
      }

      await this.verificationTokenRepository.deleteActiveByUserIdAndPurpose(identity.userId, 'password_reset')

      const rawToken = randomUUID()
      const tokenHash = this.jwtService.hashToken(rawToken)
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
      const token = new VerificationToken(
        randomUUID(), identity.userId, 'password_reset', tokenHash, expiresAt, null, new Date(),
      )
      await this.verificationTokenRepository.save(token)

      await this.mailSender.sendPasswordResetEmail(email.value, rawToken)

      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), identity.userId, 'auth.password_reset.request', 'success',
        ctx.ipAddress, ctx.userAgent, null, new Date(),
      ))
    } catch (error) {
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), null, 'auth.password_reset.request', 'failure',
        ctx.ipAddress, ctx.userAgent,
        { reason: error instanceof Error ? error.message : 'unknown' },
        new Date(),
      ))
      throw error
    }
  }
}
