import type { Movie } from './Movie.js'

export interface IMovieRepository {
  findById(id: string): Promise<Movie | null>
  save(movie: Movie): Promise<void>
}
