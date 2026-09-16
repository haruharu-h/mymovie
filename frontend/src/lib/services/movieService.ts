import { apiClient } from '@/lib/apiClient'
import type { TmdbMovie, MovieDetailResponse } from '@/types/movie'

export function searchMovies(query: string): Promise<{ movies: TmdbMovie[] }> {
  return apiClient(`/api/movies/search?q=${encodeURIComponent(query)}`)
}

export function registerMovie(tmdbId: string): Promise<void> {
  return apiClient('/api/movies', {
    method: 'POST',
    body: JSON.stringify({ tmdbId }),
  })
}

export function getMovieDetail(tmdbId: string): Promise<MovieDetailResponse> {
  return apiClient(`/api/movies/${tmdbId}`)
}
