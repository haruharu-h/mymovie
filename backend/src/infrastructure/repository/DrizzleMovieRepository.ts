import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { movies } from '../db/schema.js'
import { Movie } from '../../domain/movie/Movie.js'
import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'

export class DrizzleMovieRepository implements IMovieRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Movie | null> {
    const row = await this.db.query.movies.findFirst({
      where: eq(movies.id, id),
    })

    if (!row) return null

    return new Movie(row.id, row.title, row.posterPath, row.releaseDate, row.updatedAt)
  }

  async save(movie: Movie): Promise<void> {
    await this.db.insert(movies).values({
      id: movie.id,
      title: movie.title,
      posterPath: movie.posterPath,
      releaseDate: movie.releaseDate,
      updatedAt: movie.updatedAt,
    }).onConflictDoNothing()
  }
}
