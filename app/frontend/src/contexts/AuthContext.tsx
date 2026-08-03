import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { tokenStore } from '../lib/tokenStore'
import type { CurrentUser } from '../types/user'

type AuthContextType = {
  accessToken: string | null
  currentUser: CurrentUser | null
  isLoading: boolean
  register: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshPromiseRef = useRef<Promise<void> | null>(null)

  const setToken = (token: string | null) => {
    setAccessToken(token)
    tokenStore.set(token)
  }

  const fetchCurrentUser = async () => {
    const res = await fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${tokenStore.get()}` },
      credentials: 'include',
    })
    if (!res.ok) return
    const data = await res.json() as CurrentUser
    setCurrentUser(data)
  }

  useEffect(() => {
    if (accessToken) {
      fetchCurrentUser()
    } else {
      setCurrentUser(null)
    }
  }, [accessToken])

  // アプリ起動時にリフレッシュトークンからアクセストークンを復元する
  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
  }, [])

  const register = async (email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const { message } = await res.json()
      throw new Error(message)
    }
    const { accessToken } = await res.json()
    setToken(accessToken)
  }

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const { message } = await res.json()
      throw new Error(message)
    }
    const { accessToken } = await res.json()
    setToken(accessToken)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setToken(null)
  }

  const refresh = (): Promise<void> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current
    refreshPromiseRef.current = (async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setToken(null)
        return
      }
      const { accessToken } = await res.json()
      setToken(accessToken)
    })().finally(() => {
      refreshPromiseRef.current = null
    })
    return refreshPromiseRef.current
  }

  return (
    <AuthContext.Provider value={{ accessToken, currentUser, isLoading, register, login, logout, refresh, refreshProfile: fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
