import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'
import type { IReviewRepository, ReviewWithUser } from '../../domain/review/IReviewRepository.js'
import type { Movie } from '../../domain/movie/Movie.js'
import { AppError } from '../../domain/shared/AppError.js'

export type MovieDetailResult = {
  movie: Movie
  reviews: ReviewWithUser[]
  averageScore: number | null
}

export class GetMovieDetail {
  constructor(
    private readonly movieRepository: IMovieRepository,
    private readonly reviewRepository: IReviewRepository,
  ) {}

  async execute(movieId: string): Promise<MovieDetailResult> {
    const movie = await this.movieRepository.findById(movieId)

    if (!movie) {
      throw new AppError('映画が見つかりません', 404)
    }

    const reviews = await this.reviewRepository.findAllByMovieId(movieId)

    const averageScore = reviews.length > 0
      ? Math.round(reviews.reduce((sum, { review }) => sum + review.score.value, 0) / reviews.length)
      : null

    return { movie, reviews, averageScore }
  }
}
