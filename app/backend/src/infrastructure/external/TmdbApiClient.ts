export type TmdbMovie = {
  id: string
  title: string
  posterPath: string
  releaseDate: string
}

type TmdbSearchResult = {
  results: Array<{
    id: number
    title: string
    poster_path: string | null
    release_date: string
  }>
}

export class TmdbApiClient {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.themoviedb.org/3'

  constructor() {
    const apiKey = process.env.TMDB_API_KEY
    if (!apiKey) throw new Error('TMDB_API_KEY is not set')
    this.apiKey = apiKey
  }

  async searchMovies(query: string): Promise<TmdbMovie[]> {
    const url = `${this.baseUrl}/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&language=ja-JP`
    const res = await fetch(url)
    const data = await res.json() as TmdbSearchResult

    return data.results.map(m => ({
      id: String(m.id),
      title: m.title,
      posterPath: m.poster_path ?? '',
      releaseDate: m.release_date,
    }))
  }

  async findById(tmdbId: string): Promise<TmdbMovie | null> {
    const url = `${this.baseUrl}/movie/${tmdbId}?api_key=${this.apiKey}&language=ja-JP`
    const res = await fetch(url)
    if (!res.ok) return null
    const m = await res.json() as { id: number; title: string; poster_path: string | null; release_date: string }

    return {
      id: String(m.id),
      title: m.title,
      posterPath: m.poster_path ?? '',
      releaseDate: m.release_date,
    }
  }
}
