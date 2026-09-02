import { describe, it, expect, afterAll } from '@jest/globals'
import { buildApp } from './buildApp.js'

// CORSのプリフライト応答。@fastify/corsのデフォルトmethodsは'GET,HEAD,POST'のみで
// PATCH/DELETEを含まないため、明示的に許可していないと本番（フロント・バックが別ドメインの
// クロスサイト構成）でPATCH/DELETEを使う全ルートがブラウザにブロックされる
// （ローカル/E2EはVite devサーバーのproxyで同一オリジンに見えるため検出できない。
// `docs/testing.md`「クロスオリジン特有のバグ」参照）。
describe('buildApp CORS設定 (E2E)', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL

  afterAll(() => {
    process.env.FRONTEND_URL = originalFrontendUrl
  })

  it.each(['PATCH', 'DELETE'] as const)(
    '%sリクエストのプリフライトをAccess-Control-Allow-Methodsで許可する',
    async method => {
      process.env.FRONTEND_URL = 'https://frontend.example.com'
      const app = buildApp({}, { logger: false, forceFlushTelemetry: false })

      const res = await app.inject({
        method: 'OPTIONS',
        url: '/users/me/avatar',
        headers: {
          origin: 'https://frontend.example.com',
          'access-control-request-method': method,
        },
      })

      expect(res.headers['access-control-allow-methods']).toContain(method)

      await app.close()
    },
  )
})
