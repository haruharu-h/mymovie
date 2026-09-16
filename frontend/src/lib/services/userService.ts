import { apiClient } from '@/lib/apiClient'
import type { AvatarUploadPolicy, CurrentUser, UpdateProfileInput, UserSummary } from '@/types/user'

export function searchUsers(query: string): Promise<{ users: UserSummary[] }> {
  return apiClient(`/api/users/search?q=${encodeURIComponent(query)}`)
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiClient('/api/users/me')
}

export function updateProfile(data: UpdateProfileInput): Promise<void> {
  return apiClient('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ①: mymovieのバックエンドに「これからこの形式の画像をアップロードしたい」と伝え、
// GCSへの署名付きPOST policyを発行してもらう。apiClient経由（Authorization必須・JSON）
export function requestAvatarUploadUrl(contentType: string): Promise<AvatarUploadPolicy> {
  return apiClient('/api/users/me/avatar-upload-url', {
    method: 'POST',
    body: JSON.stringify({ contentType }),
  })
}

// ②: ①でもらった署名付きPOST policyを使い、ブラウザからGCSへ直接アップロードする。
// 宛先がmymovieのバックエンドではないため、apiClientを使わず素のfetchを使う
// （resolveApiPathでURLが壊れる・Content-Type強制でmultipart境界が壊れる・
// Authorization/CookieをGoogle側に送ってしまう、という3つの問題を避けるため）
export async function uploadAvatarFile(policy: AvatarUploadPolicy, file: File): Promise<void> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(policy.fields)) {
    formData.append(key, value)
  }
  // policyの条件（RequestAvatarUploadUrl側で['eq', '$Content-Type', contentType]として指定）は
  // フォームの'Content-Type'フィールドを直接見る。file part自体が持つcontent-typeヘッダーとは
  // 別物なので、明示的に追加する必要がある
  formData.append('Content-Type', file.type)
  // 'file'は署名付きPOST policyの仕様で決まった特別なキー名。GCSはフォームを先頭から
  // 順に読むため、条件を表すfieldsより後（＝フォームの最後）に置く必要がある
  formData.append('file', file)

  const res = await fetch(policy.uploadUrl, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('画像のアップロードに失敗しました')
  }
}

// ③: アップロード完了をバックエンドに伝え、バックエンド側でGCSに実際に存在するか確認した上で
// DBに公開URLを保存してもらう
export function confirmAvatarUpload(): Promise<void> {
  return apiClient('/api/users/me/avatar', { method: 'PATCH' })
}
