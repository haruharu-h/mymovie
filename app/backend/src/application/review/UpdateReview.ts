import { Score } from '../../domain/review/Score.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'

export class UpdateReview {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute(reviewId: string, userId: string, scoreValue: number): Promise<void> {
    const review = await this.reviewRepository.findById(reviewId)

    if (!review) {
      throw new AppError('レビューが見つかりません', 404)
    }

    if (!review.canBeUpdatedBy(userId)) {
      throw new AppError('このレビューを編集する権限がありません', 403)
    }

    const newScore = Score.create(scoreValue)
    const updated = review.withScore(newScore)
    await this.reviewRepository.update(updated)
  }
}
