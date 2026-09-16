import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { getReviews, deleteReview, updateReviewScore } from '@/lib/services/reviewService'
import { useAuth } from '@/contexts/AuthContext'
import { calcAge } from '@/lib/calcAge'
import { StarRating } from '@/components/StarRating'
import type { ReviewItem, SortOrder } from '@/types/review'

const SORT_LABELS: Record<SortOrder, string> = {
  registeredAt: '登録日順',
  score: 'スコア順',
  releaseDate: '公開日順',
}

export default function ReviewsPage() {
  const { currentUser } = useAuth()
  const age = useMemo(() => calcAge(currentUser?.birthdate ?? null), [currentUser?.birthdate])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>('registeredAt')
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const data = await getReviews(sortOrder)
        setReviews(data.reviews ?? [])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'レビューの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [sortOrder])

  const handleEditStart = (item: ReviewItem) => {
    setEditingId(item.id)
    setEditScore(String(item.score))
  }

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm('このレビューを削除しますか？')) return
    setDeletingId(reviewId)
    setErrorMessage('')
    try {
      await deleteReview(reviewId)
      setReviews(prev => prev.filter(r => r.id !== reviewId))
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'レビューの削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditScore('')
  }

  const handleEditSave = async (reviewId: string) => {
    setIsSaving(true)
    setErrorMessage('')
    try {
      await updateReviewScore(reviewId, Number(editScore))
      setReviews(prev => {
        const updated = prev.map(r => r.id === reviewId ? { ...r, score: Number(editScore) } : r)
        if (sortOrder === 'score') {
          return [...updated].sort((a, b) => b.score - a.score)
        }
        return updated
      })
      setEditingId(null)
      setEditScore('')
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'スコアの更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{currentUser?.name ?? '...'}</h1>
          {age !== null && <p className="text-sm text-gray-500">age {age}</p>}
        </div>
        <Link
          to="/movies/register"
          className="rounded bg-black px-3 py-1 text-sm text-white"
        >
          + 映画を登録
        </Link>
      </div>

      <div className="flex gap-2">
        {(Object.keys(SORT_LABELS) as SortOrder[]).map((order) => (
          <button
            key={order}
            onClick={() => setSortOrder(order)}
            className={`rounded px-3 py-1 text-sm ${
              sortOrder === order ? 'bg-black text-white' : 'border text-gray-600'
            }`}
          >
            {SORT_LABELS[order]}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-400">読み込み中...</p>}

      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

      {!isLoading && !errorMessage && reviews.length === 0 && (
        <p className="text-sm text-gray-500">まだレビューがありません</p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {reviews.map((item) => (
          <li key={item.id} className="flex flex-col rounded border overflow-hidden">
            {item.movie.posterPath ? (
              <Link to={`/movies/${item.movie.id}`}>
                <img
                  src={`https://image.tmdb.org/t/p/w342${item.movie.posterPath}`}
                  alt={item.movie.title}
                  loading="lazy"
                  className="w-full aspect-[2/3] object-cover hover:opacity-80 transition-opacity"
                />
              </Link>
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-100 flex items-center justify-center text-gray-300 text-xs">
                No Image
              </div>
            )}

            <div className="p-2 flex flex-col gap-1 flex-1">
              <p className="text-sm font-medium leading-snug line-clamp-2">{item.movie.title}</p>
              <p className="text-xs text-gray-400">{item.movie.releaseDate}</p>

              <div className="mt-auto pt-2 flex items-center justify-between">
                {editingId === item.id ? (
                  <div className="flex flex-col gap-1 w-full">
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={editScore}
                      onChange={(e) => setEditScore(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(item.id)
                        if (e.key === 'Escape') handleEditCancel()
                      }}
                      className="w-full rounded border px-2 py-1 text-sm text-center"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditSave(item.id)}
                        disabled={isSaving || editScore === ''}
                        className="flex-1 rounded bg-black py-1 text-xs text-white disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="flex-1 rounded border py-1 text-xs text-gray-500"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="cursor-pointer hover:opacity-60"
                      onClick={() => handleEditStart(item)}
                      title="クリックして編集"
                    >
                      <StarRating score={item.score} size="sm" />
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-gray-300 hover:text-red-400 disabled:opacity-30"
                      title="削除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
