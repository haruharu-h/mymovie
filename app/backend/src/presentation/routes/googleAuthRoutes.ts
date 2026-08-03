import type { FastifyInstance } from 'fastify'
import { generateState, generateCodeVerifier, decodeIdToken, type Google } from 'arctic'
import type { GoogleLogin } from '../../application/auth/GoogleLogin.js'

// google 認証ルートが必要とするユースケースの束
export type GoogleAuthRouteDeps = {
  googleLogin: GoogleLogin
  google: Google
}

export async function googleAuthRoutes(app: FastifyInstance, deps: GoogleAuthRouteDeps) {
  const { google } = deps

  // Google認証画面へリダイレクト
  app.get('/auth/google', async (request, reply) => {
    const state = generateState()
    const codeVerifier = generateCodeVerifier()

    reply.setCookie('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    })
    reply.setCookie('google_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    })

    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])
    return reply.redirect(url.toString())
  })

  // Googleからのコールバック
  app.get('/auth/google/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string }
    const storedState = request.cookies['google_oauth_state']
    const storedCodeVerifier = request.cookies['google_code_verifier']

    if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
      return reply.status(400).send({ message: '無効なリクエストです' })
    }

    const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier)
    const claims = decodeIdToken(tokens.idToken()) as { sub: string; email: string; name: string }

    const ctx = {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
    }

    const result = await deps.googleLogin.execute(claims.sub, claims.email, claims.name, ctx)

    const { accessToken, refreshToken } = result

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })

    // フロントエンドにアクセストークンを渡すためリダイレクト
    return reply.redirect('http://localhost:5173/auth/callback')
  })
}
