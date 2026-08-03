import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GetMovieDetail } from './GetMovieDetail.js'
import { Movie } from '../../domain/movie/Movie.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { User } from '../../domain/user/User.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'
import type { IReviewRepository, ReviewWithUser } from '../../domain/review/IReviewRepository.js'

const buildReviewWithUser = (score: number): ReviewWithUser => ({
  review: new Review('r', 'u', 'movie-1', Score.reconstruct(score), new Date()),
  user: new User('u', 'Alice', null, null, null, new Date()),
})

describe('GetMovieDetail', () => {
  let movieRepository: jest.Mocked<IMovieRepository>
  let reviewRepository: jest.Mocked<IReviewRepository>
  let getMovieDetail: GetMovieDetail

  beforeEach(() => {
    movieRepository = {
      findById: jest.fn<IMovieRepository['findById']>(),
      save: jest.fn<IMovieRepository['save']>(),
    }
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    getMovieDetail = new GetMovieDetail(movieRepository, reviewRepository)
  })

  it('映画が無ければ AppError(404)', async () => {
    movieRepository.findById.mockResolvedValue(null)
    expect.assertions(2)
    try {
      await getMovieDetail.execute('movie-1')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(404)
    }
  })

  it('レビューが無ければ averageScore は null', async () => {
    movieRepository.findById.mockResolvedValue(new Movie('movie-1', 'A', '', '2020-01-01', new Date()))
    reviewRepository.findAllByMovieId.mockResolvedValue([])

    const result = await getMovieDetail.execute('movie-1')
    expect(result.averageScore).toBeNull()
    expect(result.reviews).toEqual([])
  })

  it('レビューがあれば averageScore は平均の四捨五入', async () => {
    movieRepository.findById.mockResolvedValue(new Movie('movie-1', 'A', '', '2020-01-01', new Date()))
    reviewRepository.findAllByMovieId.mockResolvedValue([
      buildReviewWithUser(2),
      buildReviewWithUser(4),
    ])

    const result = await getMovieDetail.execute('movie-1')
    expect(result.averageScore).toBe(3) // (2+4)/2 = 3
  })
})
