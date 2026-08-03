import { eq, desc } from 'drizzle-orm'
import { AppError } from '../../domain/shared/AppError.js'
import type { DbClient } from '../db/client.js'
import { reviews, movies, users } from '../db/schema.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { Movie } from '../../domain/movie/Movie.js'
import { User } from '../../domain/user/User.js'
import type { IReviewRepository, ReviewWithMovie, ReviewWithUser, SortOrder } from '../../domain/review/IReviewRepository.js'

const POSTGRES_UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'code' in error.cause &&
    error.cause.code === POSTGRES_UNIQUE_VIOLATION
  )
}

export class DrizzleReviewRepository implements IReviewRepository {
  constructor(private readonly db: DbClient) {}

  async findAllByUserId(userId: string, sortOrder: SortOrder): Promise<ReviewWithMovie[]> {
    const orderBy = {
      score: desc(reviews.score),
      releaseDate: desc(movies.releaseDate),
      registeredAt: desc(reviews.registeredAt),
    }[sortOrder]

    const rows = await this.db
      .select()
      .from(reviews)
      .innerJoin(movies, eq(reviews.movieId, movies.id))
      .where(eq(reviews.userId, userId))
      .orderBy(orderBy)

    return rows.map(row => ({
      review: new Review(
        row.reviews.id,
        row.reviews.userId,
        row.reviews.movieId,
        Score.reconstruct(row.reviews.score),
        row.reviews.registeredAt,
      ),
      movie: new Movie(
        row.movies.id,
        row.movies.title,
        row.movies.posterPath,
        row.movies.releaseDate,
        row.movies.updatedAt,
      ),
    }))
  }

  async findAllByMovieId(movieId: string): Promise<ReviewWithUser[]> {
    const rows = await this.db
      .select()
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.movieId, movieId))
      .orderBy(desc(reviews.score))

    return rows.map(row => ({
      review: new Review(row.reviews.id, row.reviews.userId, row.reviews.movieId, Score.reconstruct(row.reviews.score), row.reviews.registeredAt),
      user: new User(row.users.id, row.users.name, row.users.email ?? null, row.users.birthdate ?? null, row.users.snsUrl ?? null, row.users.createdAt),
    }))
  }

  async findById(id: string): Promise<Review | null> {
    const row = await this.db.query.reviews.findFirst({ where: eq(reviews.id, id) })
    if (!row) return null
    return new Review(row.id, row.userId, row.movieId, Score.reconstruct(row.score), row.registeredAt)
  }

  async update(review: Review): Promise<void> {
    await this.db.update(reviews)
      .set({ score: review.score.value })
      .where(eq(reviews.id, review.id))
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(reviews).where(eq(reviews.id, id))
  }

  async save(review: Review): Promise<void> {
    try {
      await this.db.insert(reviews).values({
        id: review.id,
        userId: review.userId,
        movieId: review.movieId,
        score: review.score.value,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('この映画はすでにレビュー済みです', 409)
      }
      throw error
    }
  }
}
