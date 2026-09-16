import type { Logger } from 'pino'
import { Movie } from '../../domain/movie/Movie.js'
import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'
import type { TmdbApiClient } from '../../infrastructure/external/TmdbApiClient.js'
import { AppError } from '../../domain/shared/AppError.js'
import { setSpanAttribute } from '../../infrastructure/tracing.js'

export class RegisterMovie {
  constructor(
    private readonly movieRepository: IMovieRepository,
    private readonly tmdbApiClient: TmdbApiClient,
    private readonly logger: Logger,
  ) {}

  async execute(tmdbId: string): Promise<void> {
    setSpanAttribute('movie.tmdb_id', tmdbId)

    const existing = await this.movieRepository.findById(tmdbId)
    if (existing) {
      setSpanAttribute('movie.registration_result', 'already_registered')
      this.logger.info({ tmdbId, registrationResult: 'already_registered' }, '映画登録: 既に登録済み')
      return
    }

    const tmdbMovie = await this.tmdbApiClient.findById(tmdbId)
    if (!tmdbMovie) {
      // ログ自体はerrorHandler.tsが出す（重複させない）。tmdbIdはAppErrorのcontext経由で
      // そのログに乗せる。「TMDBに存在しなかった映画」はカタログの穴を把握する材料になる
      setSpanAttribute('movie.registration_result', 'not_found')
      throw new AppError('映画が見つかりませんでした', 404, { tmdbId })
    }

    const movie = new Movie(
      tmdbMovie.id,
      tmdbMovie.title,
      tmdbMovie.posterPath,
      tmdbMovie.releaseDate,
      new Date(),
    )

    await this.movieRepository.save(movie)
    setSpanAttribute('movie.registration_result', 'newly_registered')
    this.logger.info({ tmdbId, registrationResult: 'newly_registered' }, '映画登録: 新規登録')
  }
}
