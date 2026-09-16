import type { IReviewRepository, ReviewWithMovie, SortOrder } from '../../domain/review/IReviewRepository.js'

export class GetReviews {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute(userId: string, sortOrder: SortOrder): Promise<ReviewWithMovie[]> {
    return this.reviewRepository.findAllByUserId(userId, sortOrder)
  }
}
