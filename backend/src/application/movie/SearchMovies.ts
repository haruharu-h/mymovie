import type { TmdbApiClient, TmdbMovie } from '../../infrastructure/external/TmdbApiClient.js'

export class SearchMovies {
  constructor(
    private readonly tmdbApiClient: TmdbApiClient,
  ) {}

  async execute(query: string): Promise<TmdbMovie[]> {
    if (!query.trim()) return []
    return this.tmdbApiClient.searchMovies(query)
  }
}
