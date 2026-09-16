export type TmdbMovie = {
  id: string
  title: string
  posterPath: string
  releaseDate: string
}

export type MovieReviewEntry = {
  id: string
  score: number
  registeredAt: string
  user: { id: string; name: string }
}

export type MovieDetailResponse = {
  movie: TmdbMovie
  averageScore: number | null
  reviews: MovieReviewEntry[]
}
