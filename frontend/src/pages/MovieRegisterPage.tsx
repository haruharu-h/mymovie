import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/lib/apiClient'
import { searchMovies, registerMovie } from '@/lib/services/movieService'
import { createReview } from '@/lib/services/reviewService'
import type { TmdbMovie } from '@/types/movie'

export default function MovieRegisterPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null)
  const [score, setScore] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      setErrorMessage('')
      try {
        const data = await searchMovies(query)
        setResults(data.movies ?? [])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : '映画の検索に失敗しました')
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (movie: TmdbMovie) => {
    setSelectedMovie(movie)
    setScore('')
  }

  const handleRegister = async () => {
    if (!selectedMovie) return

    setIsRegistering(true)
    setErrorMessage('')
    try {
      await registerMovie(selectedMovie.id)
      await createReview(selectedMovie.id, Number(score))
      navigate('/')
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '映画の登録に失敗しました')
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-bold">映画を登録する</h1>
      <input
        type="text"
        placeholder="映画タイトルを入力..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelectedMovie(null) }}
        className="w-full rounded border px-3 py-2 text-sm"
      />
      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

      {!selectedMovie && (
        <>
          {isSearching && <p className="text-sm text-gray-400">検索中...</p>}
          {results.length > 0 && (
            <ul className="space-y-2">
              {results.map((movie) => (
                <li
                  key={movie.id}
                  onClick={() => handleSelect(movie)}
                  className="flex items-center gap-3 rounded border p-3 cursor-pointer hover:bg-gray-50"
                >
                  {movie.posterPath && (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`}
                      alt={movie.title}
                      loading="lazy"
                      className="h-16 w-11 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{movie.title}</p>
                    <p className="text-sm text-gray-500">{movie.releaseDate}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selectedMovie && (
        <>
          <div className="flex items-center gap-3 rounded border p-3">
            {selectedMovie.posterPath && (
              <img
                src={`https://image.tmdb.org/t/p/w92${selectedMovie.posterPath}`}
                alt={selectedMovie.title}
                className="h-16 w-11 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedMovie.title}</p>
              <p className="text-sm text-gray-500">{selectedMovie.releaseDate}</p>
            </div>
          </div>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            placeholder="スコアを入力（0.0〜5.0）"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={handleRegister}
            disabled={isRegistering || score === ''}
            className="w-full rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {isRegistering ? '登録中...' : '登録する'}
          </button>
        </>
      )}
    </div>
  )
}
