import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GetReviews } from './GetReviews.js'
import type { IReviewRepository, ReviewWithMovie } from '../../domain/review/IReviewRepository.js'

describe('GetReviews', () => {
  let reviewRepository: jest.Mocked<IReviewRepository>
  let getReviews: GetReviews

  beforeEach(() => {
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    getReviews = new GetReviews(reviewRepository)
  })

  it('リポジトリに userId と sortOrder を渡し、結果をそのまま返す', async () => {
    const rows = [] as ReviewWithMovie[]
    reviewRepository.findAllByUserId.mockResolvedValue(rows)

    const result = await getReviews.execute('user-1', 'score')

    expect(reviewRepository.findAllByUserId).toHaveBeenCalledWith('user-1', 'score')
    expect(result).toBe(rows)
  })
})
