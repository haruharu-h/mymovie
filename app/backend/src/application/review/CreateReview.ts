import { randomUUID } from 'crypto'
import type { Logger } from 'pino'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'
import { AppError } from '../../domain/shared/AppError.js'
import { setSpanAttribute } from '../../infrastructure/tracing.js'

export class CreateReview {
  constructor(
    private readonly reviewRepository: IReviewRepository,
    private readonly logger: Logger,
  ) {}

  async execute(userId: string, movieId: string, scoreValue: number): Promise<void> {
    setSpanAttribute('review.movie_id', movieId)

    // スコア不正（AppError 400）はerrorHandler.tsが既にWARNログを出すため、ここでは対応しない
    const score = Score.create(scoreValue)
    const review = new Review(randomUUID(), userId, movieId, score, new Date())

    try {
      await this.reviewRepository.save(review)
    } catch (error) {
      // 重複投稿（AppError 409）もerrorHandler.tsが既にWARNログを出すため、ログは重複させない
      if (error instanceof AppError) {
        setSpanAttribute('review.creation_result', 'duplicate')
      }
      throw error
    }

    setSpanAttribute('review.creation_result', 'created')
    this.logger.info({ movieId, reviewId: review.id, creationResult: 'created' }, 'レビュー投稿: 成功')
  }
}
