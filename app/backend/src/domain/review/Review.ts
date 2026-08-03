import { Score } from './Score.js'

export class Review {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly movieId: string,
    readonly score: Score,
    readonly registeredAt: Date,
  ) {}

  withScore(score: Score): Review {
    return new Review(this.id, this.userId, this.movieId, score, this.registeredAt)
  }

  canBeDeletedBy(userId: string): boolean {
    return this.userId === userId
  }

  canBeUpdatedBy(userId: string): boolean {
    return this.userId === userId
  }
}
