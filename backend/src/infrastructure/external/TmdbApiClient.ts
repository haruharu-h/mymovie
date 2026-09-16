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
  private readonly readAccessToken: string
  private readonly baseUrl = 'https://api.themoviedb.org/3'

  constructor() {
    const readAccessToken = process.env.TMDB_READ_ACCESS_TOKEN
    if (!readAccessToken) throw new Error('TMDB_READ_ACCESS_TOKEN is not set')
    this.readAccessToken = readAccessToken
  }

  // 認証情報はクエリパラメータ（v3の`api_key=`方式）ではなくAuthorizationヘッダーで送る。
  // クエリパラメータだとURLがOTelのspan属性（url.full）等に平文で乗ってしまう
  // （docs/decisions.md「TMDB APIキーがspan属性経由でNew Relicに送信されていた」参照）
  private authHeaders(): HeadersInit {
    return { Authorization: `Bearer ${this.readAccessToken}` }
  }

  async searchMovies(query: string): Promise<TmdbMovie[]> {
    const url = `${this.baseUrl}/search/movie?query=${encodeURIComponent(query)}&language=ja-JP`
    const res = await fetch(url, { headers: this.authHeaders() })
    const data = await res.json() as TmdbSearchResult

    return data.results.map(m => ({
      id: String(m.id),
      title: m.title,
      posterPath: m.poster_path ?? '',
      releaseDate: m.release_date,
    }))
  }

  async findById(tmdbId: string): Promise<TmdbMovie | null> {
    const url = `${this.baseUrl}/movie/${tmdbId}?language=ja-JP`
    const res = await fetch(url, { headers: this.authHeaders() })
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
