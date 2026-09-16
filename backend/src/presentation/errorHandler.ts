import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { AppError } from '../domain/shared/AppError.js'

// エラーレスポンスの統一形。
// 全ての失敗レスポンスはこの形で返す（I で code、M で errors を足していく器）。
export type ErrorResponse = {
  message: string
}

// 想定内（ユーザー起因）エラーの共通処理：statusCode と message をそのまま返す。
// システムエラーではないがWARNで残す（不正アクセスの兆候・頻発するバリデーション失敗等を追える状態にする）
function respondWithAppError(error: AppError, request: FastifyRequest, reply: FastifyReply) {
  request.log.warn({ statusCode: error.statusCode, ...error.context }, error.message)
  return reply.status(error.statusCode).send({ message: error.message } satisfies ErrorResponse)
}

// アプリ全体のエラーをここ1箇所で HTTP レスポンスに変換する
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return respondWithAppError(error, request, reply)
  }

  // Zodスキーマによるリクエストバリデーション失敗も「入力ミス」というユーザー起因エラーの一種のため、
  // AppErrorに正規化して同じ処理経路に乗せる。生のZodメッセージ（英語）はcontext経由でログにだけ残し、
  // クライアントには日本語の汎用文言を返す
  if (hasZodFastifySchemaValidationErrors(error)) {
    const validationError = new AppError('リクエストの形式が正しくありません', 400, {
      issues: error.validation,
    })
    return respondWithAppError(validationError, request, reply)
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
