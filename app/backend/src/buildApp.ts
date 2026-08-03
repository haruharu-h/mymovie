import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { authRoutes, type AuthRouteDeps } from './presentation/routes/authRoutes.js'
import { googleAuthRoutes, type GoogleAuthRouteDeps } from './presentation/routes/googleAuthRoutes.js'
import { githubAuthRoutes, type GitHubAuthRouteDeps } from './presentation/routes/githubAuthRoutes.js'
import { movieRoutes, type MovieRouteDeps } from './presentation/routes/movieRoutes.js'
import { reviewRoutes, type ReviewRouteDeps } from './presentation/routes/reviewRoutes.js'
import { userRoutes, type UserRouteDeps } from './presentation/routes/userRoutes.js'
import { followRoutes, type FollowRouteDeps } from './presentation/routes/followRoutes.js'
import { errorHandler, notFoundHandler } from './presentation/errorHandler.js'

// アプリ全体の依存の束。各ルートグループは任意（テストは必要な分だけ渡し、本番は全部渡す）。
export type AppDeps = {
  auth?: AuthRouteDeps
  googleAuth?: GoogleAuthRouteDeps
  githubAuth?: GitHubAuthRouteDeps
  movie?: MovieRouteDeps
  review?: ReviewRouteDeps
  user?: UserRouteDeps
  follow?: FollowRouteDeps
}

type BuildAppOptions = {
  logger?: boolean
}

// ログレベル: LOG_LEVELで明示指定できるようにしつつ、未指定時は環境で妥当な既定値に倒す
// （本番はinfo以上のみ・それ以外はdebugまで見えるようにして開発時の調査をしやすくする）
const LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const loggerOptions = {
  level: LOG_LEVEL,
  // Authorizationヘッダー・Cookie（refresh_token等）をログに残さない
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  // 本番はログ集約サービス向けにJSONのまま。それ以外は人が読みやすい形に整形する
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
}

// アプリを「組み立てて返す」だけの関数。listen は絶対にしない。
// 本番起動は index.ts、テストは app.inject() で、それぞれこの関数を使う。
export function buildApp(deps: AppDeps, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: (options.logger ?? true) ? loggerOptions : false })

  // エラー・404 を1箇所で処理する（レスポンス形式を統一）
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(notFoundHandler)

  app.register(cors, {
    origin: 'http://localhost:5173',
    credentials: true,
  })
  app.register(cookie)

  // 渡された依存のあるルートグループだけ登録する
  if (deps.auth) app.register(authRoutes, deps.auth)
  if (deps.googleAuth) app.register(googleAuthRoutes, deps.googleAuth)
  if (deps.githubAuth) app.register(githubAuthRoutes, deps.githubAuth)
  if (deps.movie) app.register(movieRoutes, deps.movie)
  if (deps.review) app.register(reviewRoutes, deps.review)
  if (deps.user) app.register(userRoutes, deps.user)
  if (deps.follow) app.register(followRoutes, deps.follow)

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}
