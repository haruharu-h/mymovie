import { Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    )
  }

  if (!accessToken) return <Navigate to="/signin" replace />

  return <>{children}</>
}
