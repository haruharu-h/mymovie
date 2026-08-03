export type SortOrder = 'score' | 'releaseDate' | 'registeredAt'

export type ReviewItem = {
  id: string
  score: number
  registeredAt: string
  movie: {
    id: string
    title: string
    posterPath: string
    releaseDate: string
  }
}
