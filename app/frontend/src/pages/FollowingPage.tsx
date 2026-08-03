import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { getFollowees, unfollow } from '@/lib/services/followService'
import { calcAge } from '@/lib/calcAge'
import type { UserSummary } from '@/types/user'

export default function FollowingPage() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchFollowees = async () => {
      try {
        const data = await getFollowees()
        setUsers(data.users ?? [])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'フォロー中ユーザーの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFollowees()
  }, [])

  const handleUnfollow = async (userId: string) => {
    setUnfollowingId(userId)
    setErrorMessage('')
    try {
      await unfollow(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'フォロー解除に失敗しました')
    } finally {
      setUnfollowingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-bold">フォロー中</h1>

      {isLoading && <p className="text-sm text-gray-400">読み込み中...</p>}

      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

      {!isLoading && !errorMessage && users.length === 0 && (
        <p className="text-sm text-gray-500">フォロー中のユーザーがいません</p>
      )}

      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 rounded border p-3 hover:bg-gray-50">
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
              onClick={() => handleUnfollow(user.id)}
              disabled={unfollowingId === user.id}
              className="shrink-0 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
            >
              フォロー解除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
