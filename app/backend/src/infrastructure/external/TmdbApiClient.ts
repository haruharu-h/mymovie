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
    // 404だけが「本当にTMDBに存在しない」というビジネス上の事実。
    // それ以外の非成功レスポンス（429のレート制限・500の障害等）はシステムエラーとして
    // 区別し、呼び出し元が「見つからなかった」と誤って扱わないようにする
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`TMDB API returned ${res.status} for movie ${tmdbId}`)
    const m = await res.json() as { id: number; title: string; poster_path: string | null; release_date: string }

    return {
      id: String(m.id),
      title: m.title,
      posterPath: m.poster_path ?? '',
      releaseDate: m.release_date,
    }
  }
}
