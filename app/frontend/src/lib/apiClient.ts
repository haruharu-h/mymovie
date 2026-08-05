import { tokenStore } from './tokenStore'

// 開発時はvite.config.tsのserver.proxyが/apiをバックエンドに転送してくれるため相対パスのままでよいが、
// 本番のFirebase Hostingにはその転送機能が無いため、バックエンドの絶対URLを直接組み立てる必要がある
export function resolveApiPath(path: string): string {
  if (import.meta.env.DEV) return path
  return `${import.meta.env.VITE_BACKEND_URL}${path.replace(/^\/api/, '')}`
}

// バックエンドのAppErrorに対応。呼び出し側はres.okを見る必要がなく、
// 失敗時はここでthrowされたApiErrorをcatchすればよい。
export class ApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

function getTokenExpiry(token: string): number {
  const payload = JSON.parse(atob(token.split('.')[1]))
  return payload.exp as number
}

function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token)
  // 30秒の余裕を持たせてリフレッシュする
  return Date.now() / 1000 > exp - 30
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(resolveApiPath('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) return null
  const { accessToken } = await res.json()
  tokenStore.set(accessToken)
  return accessToken
}

// レスポンスボディをパースする。204やボディなしのレスポンスはundefinedを返す
// （バックエンドのDELETE/PATCHは成功時に空ボディの204/200を返すため）
async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : undefined
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message
  }
  return 'エラーが発生しました'
}

// 成功時はレスポンスボディをそのまま返し、失敗時はApiErrorをthrowする。
// 呼び出し側はres.ok/res.json()を意識しなくてよい。
export async function apiClient<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let token = tokenStore.get()

  if (token && isTokenExpired(token)) {
    token = await refreshAccessToken()
  }

  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(resolveApiPath(path), { ...options, headers, credentials: 'include' })
  const body = await parseBody(res)

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(body), res.status)
  }

  return body as T
}
