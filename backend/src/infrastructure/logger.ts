import pino, { type Logger } from 'pino'

// ログレベル: LOG_LEVELで明示指定できるようにしつつ、未指定時は環境で妥当な既定値に倒す
// （本番はinfo以上のみ・それ以外はdebugまで見えるようにして開発時の調査をしやすくする）
const LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

// buildApp.ts（Fastifyのrequest.log）とcontainer.ts（ユースケース用の常駐ロガー）の
// 両方から使う共通設定。どちらもpinoである以上、trace_id/span_idの自動付与
// （OTelのpino計装によるもの）は共通で効く。
export const loggerOptions = {
  level: LOG_LEVEL,
  // Authorizationヘッダー・Cookie（refresh_token等）をログに残さない
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  // 本番はログ集約サービス向けにJSONのまま。それ以外は人が読みやすい形に整形する
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
}

export function createLogger(): Logger {
  return pino(loggerOptions)
}
