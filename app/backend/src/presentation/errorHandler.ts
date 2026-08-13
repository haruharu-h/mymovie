import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../domain/shared/AppError.js'

// エラーレスポンスの統一形。
// 全ての失敗レスポンスはこの形で返す（I で code、M で errors を足していく器）。
export type ErrorResponse = {
  message: string
}

// アプリ全体のエラーをここ1箇所で HTTP レスポンスに変換する
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  // 想定内（ユーザー起因）：statusCode と message をそのまま返す。
  // システムエラーではないがWARNで残す（不正アクセスの兆候・頻発するバリデーション失敗等を追える状態にする）
  if (error instanceof AppError) {
    request.log.warn({ statusCode: error.statusCode, ...error.context }, error.message)
    return reply.status(error.statusCode).send({ message: error.message } satisfies ErrorResponse)
  }

  // Fastify 組み込みのクライアントエラー（不正JSON・型不一致など 4xx）：その statusCode で返す
  if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
    request.log.warn({ statusCode: error.statusCode }, error.message)
    return reply.status(error.statusCode).send({ message: error.message } satisfies ErrorResponse)
  }

  // 想定外（システムエラー）：詳細はサーバログにだけ残し、クライアントには汎用メッセージ
  request.log.error(error)
  return reply.status(500).send({ message: 'サーバーエラーが発生しました' } satisfies ErrorResponse)
}

// 存在しないルートへのアクセス（404）も統一形で返す
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({ message: 'リソースが見つかりません' } satisfies ErrorResponse)
}
