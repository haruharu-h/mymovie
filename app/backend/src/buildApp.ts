import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify'
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

// container.tsで作った既存のpinoインスタンスを渡す（ルートインスタンスを1つに統一するため）。
// テストでログ出力を抑えたいときだけ false を渡す
type BuildAppOptions = {
  logger: FastifyBaseLogger | false
  // telemetry.tsはNode起動時に--importで先読みする専用モジュールで、buildApp.ts（テストからも
  // importされる）から直接importすると、テスト実行時にもOTel SDKの初期化が走ってしまう。
  // それを避けるため、index.tsからだけ渡してもらう。テストはloggerと同じくfalseを明示的に渡す
  forceFlushTelemetry: (() => Promise<void>) | false
}

// アプリを「組み立てて返す」だけの関数。listen は絶対にしない。
// 本番起動は index.ts、テストは app.inject() で、それぞれこの関数を使う。
export function buildApp(deps: AppDeps, options: BuildAppOptions): FastifyInstance {
  // 既存のpinoインスタンスを渡すには logger ではなく loggerInstance を使う必要がある
  // （logger は設定オブジェクト/booleanのみ受け付ける。Fastify Reference/Logging.md参照）
  const app = Fastify(
    options.logger === false ? { logger: false } : { loggerInstance: options.logger },
  )

  // エラー・404 を1箇所で処理する（レスポンス形式を統一）
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(notFoundHandler)

  // FRONTEND_URL未設定（テスト等）はローカルのフロントエンドのデフォルト値にフォールバックする
  app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  })
  app.register(cookie)

  // Cloud Runのcpu_idleによるCPU凍結でタイマー駆動のバッチ送信が欠落することがあるため、
  // レスポンス完了ごとにtrace/metrics/logsのforceFlushを試みる
  // （docs/decisions.md「New RelicのTransactionsページにデータが無かった原因」参照）
  if (options.forceFlushTelemetry !== false) {
    const forceFlushTelemetry = options.forceFlushTelemetry
    app.addHook('onResponse', async () => {
      await forceFlushTelemetry()
    })
  }

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
