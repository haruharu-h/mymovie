import { randomUUID } from 'crypto'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'

export class CreateReview {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute(userId: string, movieId: string, scoreValue: number): Promise<void> {
    const score = Score.create(scoreValue)
    const review = new Review(randomUUID(), userId, movieId, score, new Date())
    await this.reviewRepository.save(review)
  }
}
