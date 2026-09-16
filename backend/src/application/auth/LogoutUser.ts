import { randomUUID } from 'crypto'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type LogoutContext = {
  ipAddress: string
  userAgent: string
}

export class LogoutUser {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(rawRefreshToken: string, ctx: LogoutContext): Promise<void> {
    const hash = this.jwtService.hashToken(rawRefreshToken)
    const session = await this.sessionRepository.findByRefreshTokenHash(hash)

    if (!session) {
      return
    }

    await this.sessionRepository.delete(session.id)

    await this.auditLogRepository.save(new AuditLog(
      randomUUID(), session.userId, 'auth.logout', 'success',
      ctx.ipAddress, ctx.userAgent, null, new Date(),
    ))
  }
}
