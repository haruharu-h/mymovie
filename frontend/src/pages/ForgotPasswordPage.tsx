import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { requestPasswordReset } from '@/lib/services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'エラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-6 p-8">
          <h1 className="text-2xl font-bold">メールを送信しました</h1>
          <p className="text-sm">
            入力されたメールアドレスが登録されている場合、パスワード再設定用のリンクを記載したメールを送信しました。メールをご確認ください。
          </p>
          <p className="text-center text-sm">
            <Link to="/signin" className="underline">ログインページに戻る</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <h1 className="text-2xl font-bold">パスワードをお忘れの方</h1>
        <p className="text-sm text-gray-500">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクを送信します。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {isSubmitting ? '送信中...' : '再設定用のメールを送信'}
          </button>
        </form>
        <p className="text-center text-sm">
          <Link to="/signin" className="underline">ログインページに戻る</Link>
        </p>
      </div>
    </div>
  )
}
