import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { UpdateReview } from './UpdateReview.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'

const buildReview = (userId: string): Review =>
  new Review('review-1', userId, 'movie-1', Score.create(3), new Date())

describe('UpdateReview', () => {
  let reviewRepository: jest.Mocked<IReviewRepository>
  let updateReview: UpdateReview

  beforeEach(() => {
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    updateReview = new UpdateReview(reviewRepository)
  })

  it('存在しなければ AppError(404)、update は呼ばない', async () => {
    reviewRepository.findById.mockResolvedValue(null)
    expect.assertions(3)
    try {
      await updateReview.execute('review-1', 'user-1', 4)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(404)
    }
    expect(reviewRepository.update).not.toHaveBeenCalled()
  })

  it('他人のレビューなら AppError(403)、update は呼ばない', async () => {
    reviewRepository.findById.mockResolvedValue(buildReview('owner-user'))
    expect.assertions(3)
    try {
      await updateReview.execute('review-1', 'other-user', 4)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(403)
    }
    expect(reviewRepository.update).not.toHaveBeenCalled()
  })

  it('無効なスコアなら AppError(400)、update は呼ばない', async () => {
    reviewRepository.findById.mockResolvedValue(buildReview('user-1'))
    expect.assertions(3)
    try {
      await updateReview.execute('review-1', 'user-1', 99)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }
    expect(reviewRepository.update).not.toHaveBeenCalled()
  })

  it('本人かつ有効なスコアなら新スコアで update する', async () => {
    reviewRepository.findById.mockResolvedValue(buildReview('user-1'))

    await updateReview.execute('review-1', 'user-1', 4.5)

    expect(reviewRepository.update).toHaveBeenCalledTimes(1)
    const updated = reviewRepository.update.mock.calls[0][0]
    expect(updated.score.value).toBe(4.5)
    expect(updated.id).toBe('review-1')
  })
})
