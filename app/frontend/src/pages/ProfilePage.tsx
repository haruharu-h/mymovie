import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { getCurrentUser, updateProfile } from '@/lib/services/userService'
import { useAuth } from '@/contexts/AuthContext'
import type { CurrentUser } from '@/types/user'

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
