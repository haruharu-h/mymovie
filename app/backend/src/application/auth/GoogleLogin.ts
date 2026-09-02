import { randomUUID } from 'crypto'
import { Identity } from '../../domain/auth/Identity.js'
import { Session } from '../../domain/auth/Session.js'
import { User } from '../../domain/user/User.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'
import type { JwtService } from '../shared/JwtService.js'

type GoogleLoginResult = {
  accessToken: string
  refreshToken: string
}

type GoogleLoginContext = {
  ipAddress: string
  userAgent: string
}

export class GoogleLogin {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(
    googleSub: string,
    email: string,
    name: string,
    ctx: GoogleLoginContext,
  ): Promise<GoogleLoginResult> {
    let identity = await this.identityRepository.findByProviderAndProviderId('google', googleSub)
    let userId: string

    if (identity) {
      // 既存の Google Identity → ログイン
      userId = identity.userId
    } else {
      // Google Identity なし → メールアドレスで既存ユーザーを検索（アカウント統合）
      const existingUser = await this.userRepository.findByEmail(email)

      if (existingUser) {
        // 同じメールアドレスのユーザーが存在 → Google Identity を追加して統合
        userId = existingUser.id
      } else {
        // 完全新規 → ユーザー作成
        userId = randomUUID()
        const user = new User(userId, name, email, null, null, null, new Date())
        await this.userRepository.save(user)
      }

      identity = new Identity(
        randomUUID(), userId, 'google', googleSub, null, new Date(),
      )
      await this.identityRepository.save(identity)
    }

    const refreshToken = randomUUID()
    const refreshTokenHash = this.jwtService.hashToken(refreshToken)
    const session = new Session(
      randomUUID(), userId, refreshTokenHash,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), new Date(),
    )
    await this.sessionRepository.save(session)

    const accessToken = await this.jwtService.generateAccessToken(userId)

    await this.auditLogRepository.save(new AuditLog(
      randomUUID(), userId, 'auth.google.login', 'success',
      ctx.ipAddress, ctx.userAgent, null, new Date(),
    ))

    return { accessToken, refreshToken }
  }
}
