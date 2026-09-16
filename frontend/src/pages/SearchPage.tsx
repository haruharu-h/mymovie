import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { getFollowees, follow, unfollow } from '@/lib/services/followService'
import { searchUsers } from '@/lib/services/userService'
import { calcAge } from '@/lib/calcAge'
import type { UserSummary } from '@/types/user'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchFollowees = async () => {
      try {
        const data = await getFollowees()
        setFollowingIds(new Set((data.users ?? []).map(u => u.id)))
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'フォロー中ユーザーの取得に失敗しました')
      }
    }

    fetchFollowees()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      setErrorMessage('')
      try {
        const data = await searchUsers(query)
        setResults(data.users ?? [])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'ユーザー検索に失敗しました')
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleFollow = async (userId: string) => {
    setErrorMessage('')
    try {
      await follow(userId)
      setFollowingIds(prev => new Set([...prev, userId]))
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'フォローに失敗しました')
    }
  }

  const handleUnfollow = async (userId: string) => {
    setErrorMessage('')
    try {
      await unfollow(userId)
      setFollowingIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'フォロー解除に失敗しました')
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-bold">ユーザーを探す</h1>
      <input
        type="text"
        placeholder="ユーザー名を入力..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm"
      />
      {isSearching && <p className="text-sm text-gray-400">検索中...</p>}
      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      {!isSearching && !errorMessage && query && results.length === 0 && (
        <p className="text-sm text-gray-500">ユーザーが見つかりませんでした</p>
      )}
      <ul className="space-y-2">
        {results.map((user) => (
          <li key={user.id} className="flex items-center gap-3 rounded border p-3">
            <Link to={`/users/${user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium shrink-0">
                {user.name[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{user.name}</p>
                {calcAge(user.birthdate) !== null && (
                  <p className="text-xs text-gray-400">age {calcAge(user.birthdate)}</p>
                )}
              </div>
            </Link>
            <button
              onClick={() =>
                followingIds.has(user.id) ? handleUnfollow(user.id) : handleFollow(user.id)
              }
              className="text-xl shrink-0"
            >
              {followingIds.has(user.id) ? '❤️' : '🤍'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
