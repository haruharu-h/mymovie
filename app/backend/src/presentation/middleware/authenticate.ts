import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import type { JwtService } from '../../application/shared/JwtService.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

// 認証ミドルウェアを生成するファクトリ。
// JwtService を「引数で注入」して受け取り、トップレベルで new しない（import＝副作用を避ける）。
// 生成は合成ルート（composition/container.ts）が1回だけ行う。
export function makeAuthenticate(jwtService: JwtService): preHandlerHookHandler {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers['authorization']

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: '認証が必要です' })
    }

    const token = authHeader.slice(7)

    try {
      const { userId } = await jwtService.verifyAccessToken(token)
      request.userId = userId
    } catch {
      return reply.status(401).send({ message: '認証が必要です' })
    }
  }
}
