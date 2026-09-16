export class Movie {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly posterPath: string,
    readonly releaseDate: string,
    readonly updatedAt: Date,
  ) {}
}
