import type { FastifyInstance } from 'fastify'
import { generateState, type GitHub } from 'arctic'
import type { GitHubLogin } from '../../application/auth/GitHubLogin.js'
import type { GitHubApiClient } from '../../infrastructure/external/GitHubApiClient.js'

// github 認証ルートが必要とするユースケースの束
export type GitHubAuthRouteDeps = {
  githubLogin: GitHubLogin
  github: GitHub
  gitHubApiClient: GitHubApiClient
  frontendUrl: string
}

export async function githubAuthRoutes(app: FastifyInstance, deps: GitHubAuthRouteDeps) {
  const { github } = deps

  app.get('/auth/github', async (request, reply) => {
    const state = generateState()

    reply.setCookie('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    })

    const url = github.createAuthorizationURL(state, ['user:email'])
    return reply.redirect(url.toString())
  })

  app.get('/auth/github/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string }
    const storedState = request.cookies['github_oauth_state']

    if (!code || !state || !storedState || state !== storedState) {
      return reply.status(400).send({ message: '無効なリクエストです' })
    }

    const tokens = await github.validateAuthorizationCode(code)
    const accessTokenValue = tokens.accessToken()

    const [githubUser, emails] = await Promise.all([
      deps.gitHubApiClient.getUser(accessTokenValue),
      deps.gitHubApiClient.getUserEmails(accessTokenValue),
    ])
    const primaryEmail = emails.find(e => e.primary && e.verified)?.email ?? null

    const ctx = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
    }

    const result = await deps.githubLogin.execute(
      String(githubUser.id),
      githubUser.name ?? githubUser.login,
      primaryEmail,
      ctx,
    )

    const { refreshToken } = result

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // 本番はフロントエンド(Firebase Hosting)とバックエンド(Cloud Run)が別ドメインのクロスサイト
      // 構成のため'none'が必須（'strict'/'lax'はcrossサイトのfetchにCookieを一切送らない）
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      path: '/',
    })

    return reply.redirect(`${deps.frontendUrl}/auth/callback`)
  })
}
