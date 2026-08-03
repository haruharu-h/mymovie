import { buildApp } from './buildApp.js'
import {
  buildAuthDeps,
  buildGoogleAuthDeps,
  buildGitHubAuthDeps,
  buildMovieDeps,
  buildReviewDeps,
  buildUserDeps,
  buildFollowDeps,
} from './composition/container.js'

// 本番の依存（Drizzle 実装・実サービス）を組み立ててアプリを作る
const app = buildApp({
  auth: buildAuthDeps(),
  googleAuth: buildGoogleAuthDeps(),
  githubAuth: buildGitHubAuthDeps(),
  movie: buildMovieDeps(),
  review: buildReviewDeps(),
  user: buildUserDeps(),
  follow: buildFollowDeps(),
})

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
