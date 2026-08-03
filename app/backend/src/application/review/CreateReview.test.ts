import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { CreateReview } from './CreateReview.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'

describe('CreateReview', () => {
  let reviewRepository: jest.Mocked<IReviewRepository>
  let createReview: CreateReview

  beforeEach(() => {
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    createReview = new CreateReview(reviewRepository)
  })

  it('有効なスコアなら Review を保存する', async () => {
    await createReview.execute('user-1', 'movie-1', 3.5)

    expect(reviewRepository.save).toHaveBeenCalledTimes(1)
    const saved = reviewRepository.save.mock.calls[0][0]
    expect(saved.userId).toBe('user-1')
    expect(saved.movieId).toBe('movie-1')
    expect(saved.score.value).toBe(3.5)
  })

  it('無効なスコアなら AppError(400) を投げ、保存しない', async () => {
    expect.assertions(3)
    try {
      await createReview.execute('user-1', 'movie-1', 99)
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }
    expect(reviewRepository.save).not.toHaveBeenCalled()
  })
})
