import { Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, isLoading } = useAuth()

  if (isLoading) return null

  if (!accessToken) return <Navigate to="/signin" replace />

  return <>{children}</>
}
