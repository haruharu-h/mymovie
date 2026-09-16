import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthCallbackPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    refresh()
      .then(() => navigate('/', { replace: true }))
      .catch(() => setErrorMessage('ログイン処理に失敗しました。もう一度お試しください。'))
  }, [])

  if (errorMessage) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-red-500">{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="p-4 text-center">
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  )
}
