import { AppError } from '../../domain/shared/AppError.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'

export class DeleteReview {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.findById(reviewId)

    if (!review) {
      throw new AppError('レビューが見つかりません', 404)
    }

    if (!review.canBeDeletedBy(userId)) {
      throw new AppError('このレビューを削除する権限がありません', 403)
    }

    await this.reviewRepository.delete(reviewId)
  }
}
