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

type GitHubLoginResult = {
  accessToken: string
  refreshToken: string
}

type GitHubLoginContext = {
  ipAddress: string
  userAgent: string
}

export class GitHubLogin {
  constructor(
    private readonly identityRepository: IIdentityRepository,
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(
    githubId: string,
    name: string,
    email: string | null,
    ctx: GitHubLoginContext,
  ): Promise<GitHubLoginResult> {
    let identity = await this.identityRepository.findByProviderAndProviderId('github', githubId)
    let userId: string

    if (identity) {
      // 既存の GitHub Identity → ログイン
      userId = identity.userId
    } else {
      // GitHub Identity なし → メールアドレスで既存ユーザーを検索（アカウント統合）
      const existingUser = email ? await this.userRepository.findByEmail(email) : null

      if (existingUser) {
        // 同じメールアドレスのユーザーが存在 → GitHub Identity を追加して統合
        userId = existingUser.id
      } else {
        // 完全新規 → ユーザー作成
        userId = randomUUID()
        const user = new User(userId, name, email, null, null, new Date())
        await this.userRepository.save(user)
      }

      identity = new Identity(
        randomUUID(), userId, 'github', githubId, null, new Date(),
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
      randomUUID(), userId, 'auth.github.login', 'success',
      ctx.ipAddress, ctx.userAgent, null, new Date(),
    ))

    return { accessToken, refreshToken }
  }
}
