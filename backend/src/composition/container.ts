// 合成ルート（composition root）
// アプリ全体で「実装」を1回ずつ生成し、各ルートが必要とするユースケースを組み立てて配る。
// ここだけが具体実装（Drizzle*, TmdbApiClient, JwtService）を知ってよい唯一の場所。

// --- infrastructure / shared services（実装） ---
import { createDbClient } from '../infrastructure/db/client.js'
import { DrizzleIdentityRepository } from '../infrastructure/repository/DrizzleIdentityRepository.js'
import { DrizzleUserRepository } from '../infrastructure/repository/DrizzleUserRepository.js'
import { DrizzleSessionRepository } from '../infrastructure/repository/DrizzleSessionRepository.js'
import { DrizzleAuditLogRepository } from '../infrastructure/repository/DrizzleAuditLogRepository.js'
import { DrizzleMovieRepository } from '../infrastructure/repository/DrizzleMovieRepository.js'
import { DrizzleReviewRepository } from '../infrastructure/repository/DrizzleReviewRepository.js'
import { DrizzleFollowRepository } from '../infrastructure/repository/DrizzleFollowRepository.js'
import { DrizzleVerificationTokenRepository } from '../infrastructure/repository/DrizzleVerificationTokenRepository.js'
import { TmdbApiClient } from '../infrastructure/external/TmdbApiClient.js'
import { GitHubApiClient } from '../infrastructure/external/GitHubApiClient.js'
import { GcsAvatarSigner } from '../infrastructure/external/GcsAvatarSigner.js'
import { SendGridMailSender } from '../infrastructure/external/SendGridMailSender.js'
import { createLogger } from '../infrastructure/logger.js'
import { JwtService } from '../application/shared/JwtService.js'
import { Google, GitHub } from 'arctic'
import { makeAuthenticate } from '../presentation/middleware/authenticate.js'

// --- use cases ---
import { RegisterUser } from '../application/auth/RegisterUser.js'
import { LoginUser } from '../application/auth/LoginUser.js'
import { RefreshToken } from '../application/auth/RefreshToken.js'
import { LogoutUser } from '../application/auth/LogoutUser.js'
import { GoogleLogin } from '../application/auth/GoogleLogin.js'
import { GitHubLogin } from '../application/auth/GitHubLogin.js'
import { RequestPasswordReset } from '../application/auth/RequestPasswordReset.js'
import { ResetPassword } from '../application/auth/ResetPassword.js'
import { SearchMovies } from '../application/movie/SearchMovies.js'
import { RegisterMovie } from '../application/movie/RegisterMovie.js'
import { GetMovieDetail } from '../application/movie/GetMovieDetail.js'
import { GetReviews } from '../application/review/GetReviews.js'
import { CreateReview } from '../application/review/CreateReview.js'
import { UpdateReview } from '../application/review/UpdateReview.js'
import { DeleteReview } from '../application/review/DeleteReview.js'
import { GetCurrentUser } from '../application/user/GetCurrentUser.js'
import { SearchUsers } from '../application/user/SearchUsers.js'
import { UpdateUserProfile } from '../application/user/UpdateUserProfile.js'
import { RequestAvatarUploadUrl } from '../application/user/RequestAvatarUploadUrl.js'
import { UpdateUserAvatar } from '../application/user/UpdateUserAvatar.js'
import { FollowUser } from '../application/follow/FollowUser.js'
import { UnfollowUser } from '../application/follow/UnfollowUser.js'
import { GetFollowees } from '../application/follow/GetFollowees.js'

// --- route deps types ---
import type { AuthRouteDeps } from '../presentation/routes/authRoutes.js'
import type { GoogleAuthRouteDeps } from '../presentation/routes/googleAuthRoutes.js'
import type { GitHubAuthRouteDeps } from '../presentation/routes/githubAuthRoutes.js'
import type { MovieRouteDeps } from '../presentation/routes/movieRoutes.js'
import type { ReviewRouteDeps } from '../presentation/routes/reviewRoutes.js'
import type { UserRouteDeps } from '../presentation/routes/userRoutes.js'
import type { FollowRouteDeps } from '../presentation/routes/followRoutes.js'

// ============================================================
// 実装のインスタンスをアプリ全体で1回ずつ生成（ここで共有される）
// ============================================================
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}
const db = createDbClient(databaseUrl)

const identityRepository = new DrizzleIdentityRepository(db)
const userRepository = new DrizzleUserRepository(db)
const sessionRepository = new DrizzleSessionRepository(db)
const auditLogRepository = new DrizzleAuditLogRepository(db)
const movieRepository = new DrizzleMovieRepository(db)
const reviewRepository = new DrizzleReviewRepository(db)
const followRepository = new DrizzleFollowRepository(db)
const verificationTokenRepository = new DrizzleVerificationTokenRepository(db)
const tmdbApiClient = new TmdbApiClient()
const gitHubApiClient = new GitHubApiClient()
const gcsAvatarSigner = new GcsAvatarSigner()
const mailSender = new SendGridMailSender()
const jwtService = new JwtService()
// request.log（Fastifyがリクエスト到着時に生成するもの）は起動時点でまだ存在しないため使えない。
// movieRepository/tmdbApiClientと同じく、起動時に1回だけ作って全ユースケースで使い回す。
// buildApp.ts（Fastifyのlogger）にもそのまま渡し、pinoのルートインスタンスを1つに統一する
export const logger = createLogger()

// 認証ミドルウェア・OAuthクライアントもここ（唯一の合成ルート）で1回だけ生成する
const authenticate = makeAuthenticate(jwtService)

// OAuthプロバイダに登録するコールバックURL・ログイン完了後のリダイレクト先は
// dev/prodで異なるため環境変数化する（本番はCloud Run/Firebase Hostingの実URL）。
// buildGoogleAuthDeps/buildGitHubAuthDepsという別関数の中でも使うため、
// if文による絞り込み（関数境界を越えると効かない）ではなくIIFEでstring型を確定させる
function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

const backendUrl = readRequiredEnv('BACKEND_URL')
const frontendUrl = readRequiredEnv('FRONTEND_URL')

const googleClient = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${backendUrl}/auth/google/callback`,
)
const githubClient = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${backendUrl}/auth/github/callback`,
)

// ============================================================
// 各ルートの依存を組み立てる
// ============================================================
export function buildAuthDeps(): AuthRouteDeps {
  return {
    registerUser: new RegisterUser(
      identityRepository,
      userRepository,
      sessionRepository,
      auditLogRepository,
      jwtService,
    ),
    loginUser: new LoginUser(identityRepository, sessionRepository, auditLogRepository, jwtService),
    refreshToken: new RefreshToken(sessionRepository, auditLogRepository, jwtService),
    logoutUser: new LogoutUser(sessionRepository, auditLogRepository, jwtService),
    requestPasswordReset: new RequestPasswordReset(
      identityRepository,
      verificationTokenRepository,
      auditLogRepository,
      mailSender,
      jwtService,
    ),
    resetPassword: new ResetPassword(
      identityRepository,
      sessionRepository,
      verificationTokenRepository,
      auditLogRepository,
      jwtService,
    ),
  }
}

export function buildGoogleAuthDeps(): GoogleAuthRouteDeps {
  return {
    googleLogin: new GoogleLogin(
      identityRepository,
      userRepository,
      sessionRepository,
      auditLogRepository,
      jwtService,
    ),
    google: googleClient,
    frontendUrl,
  }
}

export function buildGitHubAuthDeps(): GitHubAuthRouteDeps {
  return {
    githubLogin: new GitHubLogin(
      identityRepository,
      userRepository,
      sessionRepository,
      auditLogRepository,
      jwtService,
    ),
    github: githubClient,
    gitHubApiClient,
    frontendUrl,
  }
}

export function buildMovieDeps(): MovieRouteDeps {
  return {
    searchMovies: new SearchMovies(tmdbApiClient),
    registerMovie: new RegisterMovie(movieRepository, tmdbApiClient, logger),
    getMovieDetail: new GetMovieDetail(movieRepository, reviewRepository),
    authenticate,
  }
}

export function buildReviewDeps(): ReviewRouteDeps {
  return {
    getReviews: new GetReviews(reviewRepository),
    createReview: new CreateReview(reviewRepository, logger),
    updateReview: new UpdateReview(reviewRepository),
    deleteReview: new DeleteReview(reviewRepository),
    authenticate,
  }
}

export function buildUserDeps(): UserRouteDeps {
  return {
    getCurrentUser: new GetCurrentUser(userRepository),
    searchUsers: new SearchUsers(userRepository),
    updateUserProfile: new UpdateUserProfile(userRepository),
    requestAvatarUploadUrl: new RequestAvatarUploadUrl(gcsAvatarSigner),
    updateUserAvatar: new UpdateUserAvatar(userRepository, gcsAvatarSigner),
    authenticate,
  }
}

export function buildFollowDeps(): FollowRouteDeps {
  return {
    followUser: new FollowUser(followRepository),
    unfollowUser: new UnfollowUser(followRepository),
    getFollowees: new GetFollowees(followRepository),
    authenticate,
  }
}
