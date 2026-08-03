import type { OAuth2Tokens } from 'arctic'

function base64url(input: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(input)).toString('base64url')
}

// arctic の decodeIdToken は署名検証をせずペイロードをデコードするだけなので、
// header/payloadさえJWTの形（3分割・base64url）にしておけば署名部分は捨て値でよい。
export function fakeIdToken(payload: Record<string, unknown>): string {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.signature`
}

// arctic の OAuth2Tokens は private フィールドを持つクラスのため、
// 型だけ real arctic から type-only import し、中身はテスト用のプレーンオブジェクトで満たす。
export function fakeOAuth2Tokens(overrides: Partial<{ idToken: string; accessToken: string }> = {}): OAuth2Tokens {
  return {
    data: {},
    tokenType: () => 'Bearer',
    accessToken: () => overrides.accessToken ?? 'access-token',
    accessTokenExpiresInSeconds: () => 3600,
    accessTokenExpiresAt: () => new Date(),
    hasRefreshToken: () => false,
    refreshToken: () => '',
    hasScopes: () => false,
    scopes: () => [],
    idToken: () => overrides.idToken ?? fakeIdToken({ sub: 'default-sub' }),
  }
}
