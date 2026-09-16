import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import {
  getCurrentUser,
  updateProfile,
  requestAvatarUploadUrl,
  uploadAvatarFile,
  confirmAvatarUpload,
} from '@/lib/services/userService'
import { useAuth } from '@/contexts/AuthContext'
import type { CurrentUser } from '@/types/user'

// 許可形式・サイズ上限はバックエンド（RequestAvatarUploadUrl/GcsAvatarSigner）と同じ値。
// ここでのチェックはUX目的（早く気づかせる）であり、実際の強制はサーバー/GCS側の条件で行う
const ALLOWED_AVATAR_CONTENT_TYPES: string[] = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

export default function ProfilePage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [profile, setProfile] = useState<CurrentUser | null>(null)
  const [name, setName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [snsUrl, setSnsUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // avatarPreviewUrlが別の値に切り替わる/コンポーネントがアンマウントされるたびに、
  // その時点で保持していたローカルのobject URLを解放する（メモリリーク防止）
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getCurrentUser()
        setProfile(data)
        setName(data.name)
        setBirthdate(data.birthdate ?? '')
        setSnsUrl(data.snsUrl ?? '')
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'プロフィールの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 同じファイルを連続で選び直してもchangeイベントが発火するようにリセットしておく
    e.target.value = ''
    if (!file) return

    setAvatarError('')

    if (!ALLOWED_AVATAR_CONTENT_TYPES.includes(file.type)) {
      setAvatarError('対応していない画像形式です（jpeg・png・webpのいずれかを選んでください）')
      return
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('画像サイズは5MB以内にしてください')
      return
    }

    setAvatarPreviewUrl(URL.createObjectURL(file))
    setIsUploadingAvatar(true)

    try {
      const policy = await requestAvatarUploadUrl(file.type)
      await uploadAvatarFile(policy, file)
      await confirmAvatarUpload()
      const updated = await getCurrentUser()
      setProfile(updated)
      await refreshProfile()
    } catch (error) {
      setAvatarError(error instanceof ApiError ? error.message : 'アバターのアップロードに失敗しました')
      setAvatarPreviewUrl(null)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage('')

    try {
      await updateProfile({
        name,
        birthdate: birthdate || null,
        snsUrl: snsUrl || null,
      })
      await refreshProfile()
      navigate('/')
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'プロフィールの更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p className="p-6 text-sm text-gray-400">読み込み中...</p>

  return (
    <div className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-xl font-bold">プロフィール編集</h1>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
          aria-label="アバター画像を変更する"
          className="relative h-24 w-24 overflow-hidden rounded-full border disabled:opacity-50"
        >
          {avatarPreviewUrl ?? profile?.avatarUrl ? (
            <img
              src={avatarPreviewUrl ?? profile?.avatarUrl ?? undefined}
              alt="アバター画像"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gray-200" />
          )}
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarSelect}
          className="hidden"
        />
        <p aria-live="polite" className={`min-h-[1em] text-xs ${isUploadingAvatar ? 'text-gray-500' : 'text-red-500'}`}>
          {isUploadingAvatar ? 'アップロード中...' : avatarError}
        </p>
      </div>

      {profile?.email && (
        <p className="text-sm text-gray-500">{profile.email}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">誕生日</label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">SNS URL</label>
          <input
            type="url"
            value={snsUrl}
            onChange={(e) => setSnsUrl(e.target.value)}
            placeholder="https://x.com/yourname"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
        <button
          type="submit"
          disabled={isSaving || name.trim() === ''}
          className="w-full rounded bg-black py-2 text-sm text-white disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存する'}
        </button>
      </form>
    </div>
  )
}
