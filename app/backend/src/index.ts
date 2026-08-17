import { buildApp } from './buildApp.js'
import {
  logger,
  buildAuthDeps,
  buildGoogleAuthDeps,
  buildGitHubAuthDeps,
  buildMovieDeps,
  buildReviewDeps,
  buildUserDeps,
  buildFollowDeps,
} from './composition/container.js'

// 本番の依存（Drizzle 実装・実サービス）を組み立ててアプリを作る。
// loggerはcontainer.tsで作った既存インスタンスを渡し、Fastifyの内部ロガーと
// ユースケースが使うロガーのルートインスタンスを1つに統一する
const app = buildApp(
  {
    auth: buildAuthDeps(),
    googleAuth: buildGoogleAuthDeps(),
    githubAuth: buildGitHubAuthDeps(),
    movie: buildMovieDeps(),
    review: buildReviewDeps(),
    user: buildUserDeps(),
    follow: buildFollowDeps(),
  },
  { logger },
)

// 起動（listen）はここだけの責務
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
