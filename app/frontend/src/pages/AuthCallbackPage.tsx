import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthCallbackPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    refresh().then(() => navigate('/', { replace: true }))
  }, [])

  return null
}
