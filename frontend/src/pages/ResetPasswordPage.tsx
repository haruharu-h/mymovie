import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { resetPassword } from '@/lib/services/authService'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください')
      return
    }
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }
    if (!token) return

    setError(null)
    setIsSubmitting(true)
    try {
      await resetPassword(token, password)
      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'エラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-6 p-8">
          <h1 className="text-2xl font-bold">無効なリンクです</h1>
          <p className="text-sm text-red-500">
            パスワード再設定用のリンクが正しくありません。もう一度リンクの発行をお試しください。
          </p>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="underline">パスワード再設定用のメールを再送する</Link>
          </p>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-6 p-8">
          <h1 className="text-2xl font-bold">パスワードを再設定しました</h1>
          <p className="text-sm">新しいパスワードでログインしてください。</p>
          <p className="text-center text-sm">
            <Link to="/signin" className="underline">ログインページへ</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <h1 className="text-2xl font-bold">新しいパスワードを設定</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">新しいパスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="passwordConfirm" className="text-sm font-medium">新しいパスワード（確認）</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-black py-2 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? '設定中...' : 'パスワードを再設定する'}
          </button>
        </form>
      </div>
    </div>
  )
}
