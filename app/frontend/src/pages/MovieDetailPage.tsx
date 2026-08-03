import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { getMovieDetail } from '@/lib/services/movieService'
import { StarRating } from '@/components/StarRating'
import type { MovieDetailResponse } from '@/types/movie'

export default function MovieDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const [data, setData] = useState<MovieDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const json = await getMovieDetail(tmdbId!)
        setData(json)
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : '映画情報の取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetail()
  }, [tmdbId])

  if (isLoading) return <p className="p-6 text-sm text-gray-400">読み込み中...</p>
  if (errorMessage) return <p className="p-6 text-sm text-red-500">{errorMessage}</p>
  if (!data) return <p className="p-6 text-sm text-gray-500">映画が見つかりません</p>

  const { movie, averageScore, reviews } = data

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex gap-5">
        {movie.posterPath && (
          <img
            src={`https://image.tmdb.org/t/p/w342${movie.posterPath}`}
            alt={movie.title}
            className="w-32 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-snug">{movie.title}</h1>
          <p className="text-sm text-gray-500">{movie.releaseDate}</p>
          {averageScore !== null && (
            <div className="space-y-0.5">
              <StarRating score={averageScore} size="lg" />
              <p className="text-xs text-gray-400">平均スコア</p>
            </div>
          )}
          <p className="text-sm text-gray-400">{reviews.length} 件のレビュー</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">レビュー一覧</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500">まだレビューがありません</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded border p-3">
                <Link
                  to={`/users/${r.user.id}`}
                  className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-70"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium shrink-0">
                    {r.user.name[0]}
                  </div>
                  <span className="truncate text-sm font-medium">{r.user.name}</span>
                </Link>
                <StarRating score={r.score} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
