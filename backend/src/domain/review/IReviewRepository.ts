import type { Review } from './Review.js'
import type { Movie } from '../movie/Movie.js'
import type { User } from '../user/User.js'

export type SortOrder = 'score' | 'releaseDate' | 'registeredAt'

export type ReviewWithMovie = {
  review: Review
  movie: Movie
}

export type ReviewWithUser = {
  review: Review
  user: User
}

export interface IReviewRepository {
  findAllByUserId(userId: string, sortOrder: SortOrder): Promise<ReviewWithMovie[]>
  findAllByMovieId(movieId: string): Promise<ReviewWithUser[]>
  findById(id: string): Promise<Review | null>
  save(review: Review): Promise<void>
  update(review: Review): Promise<void>
  delete(id: string): Promise<void>
}
