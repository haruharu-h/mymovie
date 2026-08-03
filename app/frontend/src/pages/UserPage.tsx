import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { getReviews } from '@/lib/services/reviewService'
import { StarRating } from '@/components/StarRating'
import type { ReviewItem, SortOrder } from '@/types/review'

const SORT_LABELS: Record<SortOrder, string> = {
  registeredAt: '登録日順',
  score: 'スコア順',
  releaseDate: '公開日順',
}

export default function UserPage() {
  const { userId } = useParams<{ userId: string }>()
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>('registeredAt')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const data = await getReviews(sortOrder, userId)
        setReviews(data.reviews ?? [])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'レビューの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [sortOrder, userId])

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-bold">レビュー一覧</h1>

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

      <ul className="space-y-3">
        {reviews.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded border p-3">
            <Link to={`/movies/${item.movie.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-70">
              {item.movie.posterPath && (
                <img
                  src={`https://image.tmdb.org/t/p/w92${item.movie.posterPath}`}
                  alt={item.movie.title}
                  loading="lazy"
                  className="h-16 w-11 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.movie.title}</p>
                <p className="text-sm text-gray-500">{item.movie.releaseDate}</p>
              </div>
            </Link>
            <div className="text-right">
              <StarRating score={item.score} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
