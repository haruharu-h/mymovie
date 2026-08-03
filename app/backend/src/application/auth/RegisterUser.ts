import { randomUUID } from 'crypto'
import { AppError } from '../../domain/shared/AppError.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import { Email } from '../../domain/auth/Email.js'
import { Password } from '../../domain/auth/Password.js'
import { User } from '../../domain/user/User.js'
import { Identity } from '../../domain/auth/Identity.js'
import { Session } from '../../domain/auth/Session.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type RegisterResult = {
  accessToken: string
  refreshToken: string
}

type RegisterContext = {
  ipAddress: string
  userAgent: string
}

export class RegisterUser {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(rawEmail: string, rawPassword: string, ctx: RegisterContext): Promise<RegisterResult> {
    try {
      // 1. バリデーション
      const email = Email.create(rawEmail)
      const password = await Password.create(rawPassword)

      // 2. メールアドレスの重複チェック
      const existing = await this.identityRepository.findByProviderAndProviderId('email', email.value)
      if (existing) {
        throw new AppError('このメールアドレスは既に登録されています', 409)
      }

      // 3. User を作って保存
      const userId = randomUUID()
      await this.userRepository.save(new User(userId, email.value, email.value, null, null, new Date()))

      // 4. Identity を作って保存
      const identity = new Identity(
        randomUUID(),
        userId,
        'email',
        email.value,
        password.value,
        new Date(),
      )
      await this.identityRepository.save(identity)

      // 5. アクセストークンを発行
      const accessToken = await this.jwtService.generateAccessToken(userId)

      // 6. リフレッシュトークンを発行・Session を保存
      const refreshToken = randomUUID()
      const refreshTokenHash = await this.jwtService.hashToken(refreshToken)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const session = new Session(randomUUID(), userId, refreshTokenHash, expiresAt, new Date())
      await this.sessionRepository.save(session)

      // 7. 監査ログ（成功）
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), userId, 'auth.register', 'success',
        ctx.ipAddress, ctx.userAgent, null, new Date(),
      ))

      return { accessToken, refreshToken }

    } catch (error) {
      // 監査ログ（失敗）
      await this.auditLogRepository.save(new AuditLog(
        randomUUID(), null, 'auth.register', 'failure',
        ctx.ipAddress, ctx.userAgent,
        { reason: error instanceof Error ? error.message : 'unknown' },
        new Date(),
      ))
      throw error
    }
  }
}
