import { Movie } from '../../domain/movie/Movie.js'
import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'
import type { TmdbApiClient } from '../../infrastructure/external/TmdbApiClient.js'
import { AppError } from '../../domain/shared/AppError.js'

export class RegisterMovie {
  constructor(
    private readonly movieRepository: IMovieRepository,
    private readonly tmdbApiClient: TmdbApiClient,
  ) {}

  async execute(tmdbId: string): Promise<void> {
    const existing = await this.movieRepository.findById(tmdbId)
    if (existing) return

    const tmdbMovie = await this.tmdbApiClient.findById(tmdbId)
    if (!tmdbMovie) {
      throw new AppError('映画が見つかりませんでした', 404)
    }

    const movie = new Movie(
      tmdbMovie.id,
      tmdbMovie.title,
      tmdbMovie.posterPath,
      tmdbMovie.releaseDate,
      new Date(),
    )

    await this.movieRepository.save(movie)
  }
}
