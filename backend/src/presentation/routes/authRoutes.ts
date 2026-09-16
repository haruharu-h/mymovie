import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { RegisterUser } from '../../application/auth/RegisterUser.js'
import type { LoginUser } from '../../application/auth/LoginUser.js'
import type { RefreshToken } from '../../application/auth/RefreshToken.js'
import type { LogoutUser } from '../../application/auth/LogoutUser.js'

// email/passwordの型・必須チェックのみを担う（メール形式・パスワード強度等のビジネスルールは
// Email/Passwordバリューオブジェクトに一本化する方針のため書かない）
const AuthCredentialsBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

// auth ルートが必要とするユースケースの束
export type AuthRouteDeps = {
  registerUser: RegisterUser
  loginUser: LoginUser
  refreshToken: RefreshToken
  logoutUser: LogoutUser
}

export async function authRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/register',
    { schema: { body: AuthCredentialsBodySchema } },
    async (request, reply) => {
      const { email, password } = request.body

      const ctx = {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      }

      const result = await deps.registerUser.execute(email, password, ctx)

      const { accessToken, refreshToken } = result

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // 本番はフロントエンド(Firebase Hosting)とバックエンド(Cloud Run)が別ドメインのクロスサイト
        // 構成のため'none'が必須（'strict'/'lax'はcrossサイトのfetchにCookieを一切送らない）
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        path: '/',
      })

      return reply.send({ accessToken })
    },
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login',
    { schema: { body: AuthCredentialsBodySchema } },
    async (request, reply) => {
      const { email, password } = request.body

      const ctx = {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      }

      const result = await deps.loginUser.execute(email, password, ctx)

      const { accessToken, refreshToken } = result

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // 本番はフロントエンド(Firebase Hosting)とバックエンド(Cloud Run)が別ドメインのクロスサイト
        // 構成のため'none'が必須（'strict'/'lax'はcrossサイトのfetchにCookieを一切送らない）
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        path: '/',
      })

      return reply.send({ accessToken })
    },
  )

  app.post('/auth/refresh', async (request, reply) => {
    const rawRefreshToken = request.cookies['refresh_token']

    if (!rawRefreshToken) {
      return reply.status(401).send({ message: 'リフレッシュトークンがありません' })
    }

    const ctx = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
    }

    const result = await deps.refreshToken.execute(rawRefreshToken, ctx)

    const { accessToken, refreshToken } = result

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // 本番はフロントエンド(Firebase Hosting)とバックエンド(Cloud Run)が別ドメインのクロスサイト
      // 構成のため'none'が必須（'strict'/'lax'はcrossサイトのfetchにCookieを一切送らない）
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      path: '/',
    })

    return reply.send({ accessToken })
  })

  app.post('/auth/logout', async (request, reply) => {
    const rawRefreshToken = request.cookies['refresh_token']

    if (rawRefreshToken) {
      const ctx = {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      }

      await deps.logoutUser.execute(rawRefreshToken, ctx)
    }

    reply.clearCookie('refresh_token', { path: '/' })
    return reply.send({ message: 'ログアウトしました' })
  })
}
